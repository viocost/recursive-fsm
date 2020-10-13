
const { inspect } = require("util")
const { createDerivedErrorClasses } = require("./DynamicError");



class StateMachineError extends Error{ constructor(details) { super(details); this.name = "StateMachineError" } }

const err = createDerivedErrorClasses(StateMachineError, {
    msgNotExist: "MessageNotExist",
    noStateMap: "MissingStateMap",
    initStateNotInMap: "InitialStateNotFoundInMap",
    multipleInitialStates: "MultipleInitialStates",
    stateNotExist: "StateNotExist",
    blown: "StateMachineIsBlown",
    illegalEventName: "IllegalEventName",
    actionTypeInvalid: "ActionTypeInvalid",
    cannotDetermineAction: "CannotDetermineValidAction",
    invalidSubstateType: "InvalidSubstateType"
})



/**
 *
 * Actions
 *   array of lambdas passed to the transitions
 *   Each will be called with
 *     StateMachine, EventName, EventArgs
 */


class StateMachine {
    static Discard () {}  ;
    static Warn  (smName, prop) { console.warn(`${smName}: property ${prop} does not exist in current state`) };
    static Die   (prop, smName) { throw new err.msgNotExist(`${smName}, ${prop}`)   };
    static TraceLevel = {
        NONE: Symbol("none"),
        INFO: Symbol("info"),
        DEBUG: Symbol("debug")
    }


    constructor(obj, { stateMap, name = "State Machine", memory = true, isSubstate = false },
        { msgNotExistMode = StateMachine.Discard, traceLevel = StateMachine.TraceLevel.INFO} = {}){

        this.validateStateMap(stateMap)
        this.active = !isSubstate;

        this.obj = obj;

        this.memory = memory;

        this.error = false;
        this.traceLevel = traceLevel;
        this.name = name;
        this.msgNotExistMode = msgNotExistMode;
        this.stateMap = new Proxy(stateMap, {
            get(target, prop){
                if(!(prop in target)) throw new err.stateNotExist(prop)
                return target[prop];
            }

        });

        this.legalEvents = this.generateEventNames();

        this.state = this.getInitialState();



        //If state machine is active
        //Performing all entry actions and resuming all substates
        if(this.active){
            let initialEntryActions =  this.stateMap[this.getInitialState()].entry;
            if(initialEntryActions) {
                this.performActions(initialEntryActions, "Initial entry", undefined, undefined);
            }
            this.resumeSubstates();
        }


        //defining proxy for handle function
        this.handle = new Proxy(this, {
            get(target, prop) {

                if(target.error) throw new err.blown(target.error);


                if(!target.active) {
                    if (this.isInfo()) console.log(`Received event for suspended state machine ${prop}. Ignoring...`)
                    return;
                }

                if( target.legalEvents.has(prop))
                    return (...args) => {
                        setImmediate(()=>{
                            if(target.error) return;
                            try{
                                target.processEvent(prop, args);
                            }catch(err){
                                target.error = err;
                                console.warn(`${target.name}: Event handler "${prop}" thrown an exception: ${err}`)
                                if(target.isDebug()) throw err
                            }
                        })
                    };

                throw new err.illegalEventName(`${prop}`)
            }
        });
    }


    /**
     * Event desicription here means
     * an appropriate transition for the event depending on guards if any are described
     *
     * This function will try to evaluate guards and determine a signle right actions.
     * If more than one transition is found - that's an error.
     * If none of the transitions found - that measn that guards haven't passed.
     *
     *
     */
    getEventDescription(eventName, eventArgs){
        let descriptions = this.stateMap[this.state].transitions[eventName];

        if(!Array.isArray(descriptions)){
            descriptions = [ descriptions ]
        }

        let res = []

        for (let desc of descriptions){
            if(this.areGuardsPassed(desc, eventName, eventArgs)) res.push(desc)
        }

        if(res.length > 1 ){
            this.error = true;
            throw new err.cannotDetermineAction(`For ${eventName}. Multiple actions' guards passed`)
        }

        return res[0];

    }

    areGuardsPassed(evDescription, eventName, eventArgs){
        let res = true;
        if( undefined === evDescription.guards) return res;

        let guards = Array.isArray(evDescription.guards) ? evDescription.guards : [ evDescription.guards ];

        for(let guard of guards){
            if(!guard.call(this.obj, eventArgs, this, eventName)) {
                res = false;
                break;
            }
        }

        if(this.isDebug()) console.log(`   Guards evaluated to ${res} `);
        return res;
    }

    processEvent(eventName, eventArgs) {

        ///////////////////////////////////////
        // if I will change state            //
        //   call exit actions               //
        // call transition actions           //
        // if  I will change state           //
        //   change state                    //
        //   call entry actions on new state //
        ///////////////////////////////////////

        if (this.isInfo()){
            console.log(`${this.name}: Current state: ${this.state}. `)
            if(this.isDebug())
                console.log(`   Processing event ${eventName}(${inspect(eventArgs)})`);
        }

        if (!(eventName in this.stateMap[this.state].transitions)){
            this.msgNotExistMode(eventName, this.name);
            return;
        }

        // Checking guards and finding appropriate transition
        let eventDescription = this.getEventDescription(eventName, eventArgs);

        // If no transition found - return
        if(undefined === eventDescription){
            if(this.isInfo()) console.log(`  NO VALID ACTION FOUND for ${eventName}`);
            return
        }

        // Getting list of actions and new state if present
        let actions =  eventDescription["actions"];
        let newState = eventDescription["state"]

        // Handling state exit
        if (newState) {

            // Error check for non-existent state
            if (!(newState in this.stateMap)){
                this.error = true;
                throw new err.stateNotExist(newState);
            }

            this.suspendSubstates();

            // Performing local exit actions;
            let exitActions = this.stateMap[this.state].exit;
            if(exitActions) this.performActions(exitActions, "exit", eventName, eventArgs);
        }

        if (actions) this.performActions(actions, "transition", eventName, eventArgs);

        //Entering new state
        if (newState) {

            let entryActions = this.stateMap[newState].entry;
            this.state = newState;

            if(this.isInfo()) console.log(`%c ${this.name}: State is now set to ${this.state}`, 'color: #3502ff; font-size: 10px; font-weight: 600; ');
            if (entryActions) this.performActions(entryActions, "entry", eventName, eventArgs);

            //Here we need to enter all the substates of current states
            // and perform their entry actions
            for( let substate of this.stateMap[this.state].substates){
                substate.resume();
            }
        }
    }

    performActions(actions, context, eventName, eventArgs){

        if (this.isDebug()) {
            console.log(`%c ${this.name}: Calling actions for ${context} || Event name: ${eventName} `, 'color: #c45f01; font-size: 13px; font-weight: 600; ');
        }

        if (!Array.isArray(actions)){
            actions = [actions]
        }

        for( let action of actions ){
            if(typeof action !== "function") {
                this.error = true;
                throw new err.actionTypeInvalid(typeof action);
            }
            action.call(this.obj, eventArgs, this, eventName);
        }

    }

    generateEventNames(){
        let res = new Set();

        for( let state in this.stateMap){
            for(let event in this.stateMap[state].transitions){
                res.add(event)
            }
        }
        if(this.isInfo()) console.log(`${this.name} recognizes events ${inspect(Array.from(res))}`)
        return res;
    }

    isDebug(){
        return this.traceLevel === StateMachine.TraceLevel.DEBUG;
    }

    isInfo(){
        return this.traceLevel === StateMachine.TraceLevel.DEBUG || this.traceLevel === StateMachine.TraceLevel.INFO;
    }

    validateStateMap(stateMap){
        /*
        * State map constraints
        *
        * 1. Any state can be either leaf state or region
        * 2. Region state must have property region: true
        * 3. There must be exactly ONE region or state that is root.
        * 4. Any region can be either concurrent or non-concurrent
        * 5. Non-concurrent region has exactly one active child state when active
        * 6. Concurrent region assumes to have one or more child regions
        * 7. In concurrent region when active all its children regions are active
        * 8. Concurrent region cannot have leaf states as children
        * 9. Non-concurrent region can have memory enabled, so when re-entered, the state will be set to where it left off.
        * 10. By default a region considered to be non-concurrent. To make region concurrent need to set concurrent: true in state map.
                //Verify there is state map
        */
        if( stateMap === undefined) throw new err.noStateMap();

        //Verify there is initial state
        let initialState = [];
        for (let state in stateMap){
            if (stateMap[state].initial) initialState.push(state)

            //transitions must be at least an empty object
            if (!stateMap[state].hasOwnProperty("transitions")){
                stateMap[state].transitions = {}
            }

            //making sure that substates is an array for each state
            if(!stateMap[state].substates){
                stateMap[state].substates = []
            } else if (!Array.isArray(stateMap[state].substates)){
                stateMap[state].substates = [ stateMap[state].substates ]
            }

            //And each substate must be an instance of StateMachine
            for (let state of stateMap[state].substates){
                if(!(state instanceof StateMachine)) throw new err.invalidSubstateType()
            }

        }

        //Verify state map
        if(initialState.length === 0) throw new err.initStateNotInMap(`Initial state provided: ${initialState} || States: ${inspect(Object.keys(stateMap))}`);
        if(initialState.length > 1) throw new err.multipleInitialStates(inspect(initialState));
    }

    //Performs exit actions on current state and all of its substates
    //and suspends itself
    suspend(){

        this.suspendSubstates()

        let exitActions = this.stateMap[this.state].exit;
        if(exitActions) this.performActions(exitActions, "exit", eventName, eventArgs);

        if(!this.memory){
            this.state = this.getInitialState()
        }

        this.active = false;
    }

    //suspends all the substates of the current state
    suspendSubstates(){
        // if there are any substates, we need to perform their exit actions
        // and suspend them
        for( let substate of this.stateMap[this.state].substates){
            substate.suspend();
        }
    }

    //Performs entry actions on a saved state and its substates
    //and resumes itself
    resume(){
        let entryActions = this.stateMap[newState].entry;
        if (entryActions) this.performActions(entryActions, "entry", eventName, eventArgs);
        this.resumeSubstates();
        this.active = true;
    }

    //Resumes all the substates of the current state
    resumeSubstates(){
        // if there are any substates, we need to perform their exit actions
        // and suspend them
        for( let substate of this.stateMap[this.state].substates){
            substate.resume();
        }
    }

    getInitialState(){
        for (let state in this.stateMap){
            if(this.stateMap[state].initial) return state;
        }
    }
}






module.exports = {
    StateMachine: StateMachine
}

const { StateMachine } = require("./AdvStateMachine");

let psm = new StateMachine(null, {
    name: "Pedestrian SM",
    stateMap: {
        standing: {
            initial: true,
            entry: () => { console.log("Entering standing") },
            transitions: {
                walk: {
                    state: "walking"
                }
            },

            exit: () => { console.log("Exiting standing") }
        },

        walking: {
            entry: () => { console.log("Entering walking") },
            transitions: {
                stop: {
                    state: "standing"
                }
            },
            exit: () => { console.log("Exiting walking") }
        }

    },
    onSuspend: () => { conole.log("Pedestrian SM suspending") },
    onResume: ()=>{ console.log("resuming Pedestrian SM") },
    memory: true
})


let tl = new StateMachine(null, {
    name: "Traffic light SM",
    stateMap: {
        green: {
            entry: () => { console.log("Entering green state") },

            transitions: {
                toYellow: {
                    state: "yellow"
                }
            },

            exit: () => { console.log("Exiting green state") },

            substates: psm

        },

        yellow: {
            entry: () => { console.log("Entering yellow state") },

            transitions: {
                toRed: {
                    state: "yellow"
                },
                toGreen: {
                    state: "green"
                }
            },

            exit: () => { console.log("Exiting yellow state") }

        },
        red: {
            entry: () => { console.log("Entering red state") },
            initial: true,

            transitions: {
                toYellow: {
                    state: "yellow"
                }
            },

            exit: () => { console.log("Exiting red state") }


        }
    },


})


tl.handle.toYellow();
tl.handle.toGreen();
psm.handle.stop()
psm.handle.walk()
psm.handle.stop()
tl.handle.toYellow();
psm.handle.walk();
tl.handle.toGreen();
psm.handle.stop()
psm.handle.walk()
tl.handle.toYellow()



try{

    //testing invalid substate type
    let ww = new StateMachine(null, {
        name: "Traffic light SM",
        stateMap: {
            green: {
                entry: () => { console.log("Entering green state") },

                transitions: {
                    toYellow: {
                        state: "yellow"
                    }
                },

                exit: () => { console.log("Exiting green state") },

                substates: [123, 342]

            },

            yellow: {
                entry: () => { console.log("Entering yellow state") },

                transitions: {
                    toRed: {
                        state: "yellow"
                    },
                    toGreen: {
                        state: "green"
                    }
                },

                exit: () => { console.log("Exiting yellow state") }

            },
            red: {
                entry: () => { console.log("Entering red state") },
                initial: true,

                transitions: {
                    toYellow: {
                        state: "yellow"
                    }
                },

                exit: () => { console.log("Exiting red state") }


            }
        },


    })

    console.log("Invalid substate test failed");
}catch(err){
    console.log("Invalid substate test passed");
}

const { StateMachine } = require("./AdvStateMachine");


let psm = new StateMachine(null, {
  name: "Pedestrian SM",
  stateMap: {
    standing: {
      entry: ()=>{ console.log("Standing") },
      transitions: {
        walk: {
          state: "walking"
        }
      },

      exit: ()=>{ console.log("Stopping standing") }
    },

    walking: {
      entry:  ()=>{console.log("Walking")},
      transitions: {
        stop: {
          state: "standing"
        }
      },
      exit: ()=>{ console.log("Stopping walking") }
    }

  },
  onSuspend: ()=>{ conole.log("Pedestrian SM suspending") }
})

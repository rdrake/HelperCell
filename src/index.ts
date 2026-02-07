import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette, InputDialog } from '@jupyterlab/apputils';
import { INotebookTracker, NotebookActions, NotebookPanel } from '@jupyterlab/notebook';
import {bugIcon} from '@jupyterlab/ui-components';
import { initializeApp } from "firebase/app";
import { getFirestore,  doc, setDoc  } from "firebase/firestore";
import {firebaseConfig} from "./config"

const CommandIds = {runCodeCell: 'toolbar-button:run-code-cell'};
var icon = bugIcon;
var timesRun = 0;
var participaint: any;

interface promptData {
  studentAnswer: string;
  instructions: string;
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function saveData(value: any)
{
  await setDoc(doc(db, "participaints", participaint), {
    ["feedback"+timesRun]: value
});   
}


// calls to server and returns AI-generated feedback
async function getFeedback(url: string, code: string, instructions: string): Promise<any>
{

  const data:promptData = {
    studentAnswer: code,
    instructions: instructions
  }

  try{
  const response = await fetch(url, {
    method: 'POST',
    headers: {
    'Content-Type': 'application/json' // Informs the server that the body is JSON
    },
    body: JSON.stringify(data)
  })
  
  return response.text()
  } catch (error) {
    console.log("Network request failed:", (error as Error).message);
  }
}

// gets information from the notebook 
function getInstructions(notebook: any)
{
  let instructions = '';
  let code = '';
  let cellCount = 0;

  // goes through each cell in the notebook until it reaches the start of the question
  while (!instructions.includes("Challenge") && !instructions.includes("Part"))
  {
    var cell = notebook.activeCell;
    cellCount += 1; // update cell count
    if (cell.model.type == 'markdown')
    {
      instructions = cell!.model.sharedModel.source + instructions;
    }
    else
    {
      code = cell!.model.sharedModel.source + code;
    }

    // next cell
    NotebookActions.selectAbove(notebook);
  }

  // go back to the originally selected cell
  for (var i = 0; i < cellCount; i++)
  {
    NotebookActions.selectBelow(notebook);
  }

  return [code, instructions];
}


// Initialization data for the feedback extension.
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'feedback:plugin',
  description: 'A JupyterLab extension.',
  autoStart: true,
  requires: [ICommandPalette, INotebookTracker],
  activate: async(
    app: JupyterFrontEnd,
    palette: ICommandPalette,
    tracker: INotebookTracker,
    nbPanel: NotebookPanel
  ) => {
    const { commands } = app;

    
    // run feedback code when the button is pressed
    commands.addCommand(CommandIds.runCodeCell, {
     icon: icon,
     caption: 'HelperCell',
     execute: async () => {
      const current = tracker.currentWidget;
      const notebook = current!.content;
      var activeCell = notebook.activeCell;

      

      if(timesRun > 0)
      {
        
      InputDialog.getItem({
        title: 'Please rate the feedback you received',
        items: ['Excellent', 'Good', 'Fair', 'Average', 'Poor'],
        editable: false,
        }).then(value => {
          console.log(value.value);
          saveData(value.value)
        });
      }
      else{
        InputDialog.getText({
          title: 'Please enter your partipant code' 
        }).then(value => {
          participaint = value.value;
});

      }

      timesRun += 1;
      var [code, question] = getInstructions(notebook);


      // inserts new cell
      NotebookActions.insertBelow(notebook);
      activeCell = notebook.activeCell;
      activeCell!.model.sharedModel.source = "Feedback loading...";

      const content = await getFeedback("http://127.0.0.1:5000/", code, question);

      // adds content to nextly created cell
      activeCell!.model.sharedModel.source = content;
      commands.execute('notebook:change-cell-to-markdown');
      activeCell = notebook.activeCell;
      activeCell!.model.sharedModel.setMetadata("editable", false);
      activeCell!.model.sharedModel.setMetadata("deletable", false);
     },
     isVisible: () => tracker.activeCell?.model.type === 'code'
    });

  }
};

export default plugin;

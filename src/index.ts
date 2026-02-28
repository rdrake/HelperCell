import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette, InputDialog } from '@jupyterlab/apputils';
import { INotebookTracker, NotebookActions } from '@jupyterlab/notebook';
import { initializeApp } from "firebase/app";
import { getFirestore,  doc, setDoc  } from "firebase/firestore";
import {firebaseConfig} from "./config"
import helpercellIcon from "../style/icons/helpercellIcon.svg"
import comment from "../style/icons/comment.svg"
import { LabIcon,  } from '@jupyterlab/ui-components';

export const helperCellIcon = new LabIcon({
  name: 'helpercell:feedback',
  svgstr: helpercellIcon
});

export const commentIcon = new LabIcon({
  name: 'helpercell:comment',
  svgstr: comment
});

const CommandIds = {runCodeCell: 'helpercell:run-code-cell', addComment: 'helpercell:add-comment'};
var icon = helperCellIcon;
var timesRun = 0;
var participaint: any = '';

interface promptData {
  studentAnswer: string;
  instructions: string;
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function getUserId()
{
  InputDialog.getText({
          title: 'Please enter your participant code' 
        }).then(value => {
          if (value.value == '')
          {
            alert("Participant code can not be blank");
            getUserId();
          }
          else
          {
            participaint = value.value;
          }
          
        });
}

function getUserFeedback()
{
  console.log(participaint);
  if(participaint)
      {
      InputDialog.getItem({
        title: 'How useful was the last feedback you received',
        items: ['', 'Very useful', 'Useful', 'Neutral', 'Useless', 'Very Useless'],
        editable: false,
        }).then(value => {
          console.log(value.value);
          if(value.value == '')
          {
            alert("Feedback can not be blank");
            getUserFeedback();
          }
          else
          {
            saveData(value.value);
          }

        });
      }
      else{
        getUserId()
      }
}

async function saveData(value: any)
{
  await setDoc(doc(db, "participaints", participaint), {
    ["feedback"+(timesRun-1)]: value
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
  ) => {
    const { commands } = app;

    
    // HelperCell
    commands.addCommand(CommandIds.runCodeCell, {
     icon: icon,
     caption: 'HelperCell',
     execute: async () => {
      const current = tracker.currentWidget;
      const notebook = current!.content;
      var activeCell = notebook.activeCell;
      console.log(timesRun);
      

      timesRun += 1;
      var [code, question] = getInstructions(notebook);

      if (timesRun > 1)
      {
        NotebookActions.insertAbove(notebook);
      }
      else
      {
        NotebookActions.insertBelow(notebook);
      }

      
      activeCell = notebook.activeCell;
      activeCell!.model.sharedModel.source = "Feedback loading...";

      const content = await getFeedback("http://127.0.0.1:5000/", code, question);

      // add content to nextly created cell
      activeCell!.model.sharedModel.source = content;


        commands.execute('notebook:change-cell-to-markdown');
        activeCell = notebook.activeCell;
        commands.execute('notebook:run-cell');
        activeCell!.model.sharedModel.setMetadata("editable", false);
        activeCell!.model.sharedModel.setMetadata("deletable", false);
        activeCell!.model.sharedModel.setMetadata("helpercell", true);
        app.commands.notifyCommandChanged(CommandIds.addComment);

      },
      isVisible: () => tracker.activeCell?.model.type === 'code'
      });

      // Provide Comments
      commands.addCommand(CommandIds.addComment, {
      icon: commentIcon,
      label: 'Provide feedback',
      execute: () => {

        console.log('Im here!');
        getUserFeedback();

      },
      isVisible: () => {
        var activeCell = tracker.activeCell;
        
        return !!activeCell?.model.sharedModel.getMetadata("helpercell") === true;
      }
      });
  
  }
  
};



      
      
export default plugin;

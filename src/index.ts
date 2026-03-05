import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette, showDialog, Dialog } from '@jupyterlab/apputils';
import { INotebookTracker, NotebookActions } from '@jupyterlab/notebook';
import { initializeApp } from "firebase/app";
import { getFirestore,  doc, setDoc, updateDoc  } from "firebase/firestore";
import {firebaseConfig} from "./config"
import helpercellIcon from "../style/icons/helpercellIcon.svg"
import comment from "../style/icons/comment.svg"
import confirm from "../style/icons/confirm.svg"
import { LabIcon,  } from '@jupyterlab/ui-components';
import { IUserManager, User } from '@jupyterlab/services';
import { Widget } from '@lumino/widgets';


export const helperCellIcon = new LabIcon({
  name: 'helpercell:feedback',
  svgstr: helpercellIcon
});

export const commentIcon = new LabIcon({
  name: 'helpercell:comment',
  svgstr: comment
});

export const confirmIcon = new LabIcon({
  name: 'helpercell:confirm',
  svgstr: confirm
});

const feedbackBody = new Widget();
feedbackBody.node.innerHTML = `
  <label>How useful was the last feedback you received: 
    <select id="feedback-select">
    <option selected value="empty"></option>
      <option value="very-useful">Very useful</option>
      <option value="useful">Useful</option>
      <option value="neutral">Neutral</option>
      <option value="useless">Useless</option>
      <option value="very-useless">Very useless</option>
    </select>
  </label>
  <br>
  <label>Additional Feedback: <input type="text" id="additional"></label>
`;

const CommandIds = {runCodeCell: 'helpercell:run-code-cell', addComment: 'helpercell:add-comment'};
var icon = commentIcon;
var timesRun = 0;
var participant: any = '';
var content = '';

interface promptData {
  studentAnswer: string;
  instructions: string;
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function getUserFeedback()
{
  console.log(participant);
  showDialog({
  title: 'Setup User',
  body: feedbackBody,
  buttons: [Dialog.cancelButton(), Dialog.okButton()]
}).then(result => {
  if (result.button.accept) {
    const additional = (feedbackBody.node.querySelector('#additional') as HTMLInputElement).value;
    
    const feedbackSelect = (feedbackBody.node.querySelector("#feedback-select") as HTMLInputElement).value;

    if(feedbackSelect != "empty")
    {
      saveData(feedbackSelect, additional, content);
    }
    else
    {
      alert("Feedback can't be blank");
      getUserFeedback();
    }
    
  }
});
  }

async function saveData(value: any, additional: any, content: any)
{
  const index = Math.max(0, timesRun - 1);
  const docRef = doc(db, "participants", participant);

  try {
    await updateDoc(docRef, {
      // Using dot notation to update a specific nested key
      [`responses.${index}`]: {
        value: value,
        additional: additional,
        feedback: content
      }
    });
  } catch (e) {
    // If the document doesn't exist yet, updateDoc will fail. 
    // In that case, use setDoc with merge: true
    await setDoc(docRef, {
      responses: {
        [index]: { value, additional, content}
      }
    }, { merge: true });
  }
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
  var currentIndex = notebook.activeCellIndex;

  // goes through each cell in the notebook until it reaches the start of the question
  while (!instructions.includes("Challenge") && !instructions.includes("Part"))
  {
    var cell = notebook.activeCell;
    var currentIndex = notebook.activeCellIndex;
    cellCount += 1; // update cell count
    if (cell.model.type == 'markdown')
    {
      instructions = cell!.model.sharedModel.source + instructions;
    }
    else
    {
      code = cell!.model.sharedModel.source + code;
    }

    if (currentIndex === 0)
    {
      break;
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
  requires: [ICommandPalette, INotebookTracker, IUserManager],
  activate: async(
    app: JupyterFrontEnd,
    palette: ICommandPalette,
    tracker: INotebookTracker,
    user: User.IManager
  ) => {
    const { commands } = app;

    // get pariticpaint code 
    participant = user.identity?.username;
    
    // HelperCell
    commands.addCommand(CommandIds.runCodeCell, {
     icon: helperCellIcon,
     caption: 'HelperCell',
     execute: async () => {
      const current = tracker.currentWidget;
      const notebook = current!.content;
      var activeCell = notebook.activeCell;
      

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

      content = await getFeedback("http://127.0.0.1:5000/", code, question);

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
      icon: () => {
        const activeCell = tracker.activeCell;
        const feedbackSubmitted = activeCell?.model.sharedModel.getMetadata("feedbackSent");
        return feedbackSubmitted ? confirmIcon : icon;
      },
      label: 'Provide feedback',
      execute: () => {
        const activeCell = tracker.activeCell;
        getUserFeedback();
        activeCell!.model.sharedModel.setMetadata("feedbackSent", true);
        app.commands.notifyCommandChanged(CommandIds.addComment);
      },
      isVisible: () => {
        var activeCell = tracker.activeCell;
        
        return !!activeCell?.model.sharedModel.getMetadata("helpercell") === true;
      }
      });
  
  }
  
};



      
      
export default plugin;

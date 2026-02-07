from flask import Flask, flash, request, render_template, redirect, url_for
from google import genai
from flask_cors import CORS
from config import SECRET_KEY, GEMINI_API_KEY

app = Flask(__name__)
app.config['SECRET_KEY'] = SECRET_KEY
app.config['TEMPLATES_AUTO_RELOAD'] = True
cors = CORS(app) # allow CORS for all domains on all routes.

question = ""
instructions = "You are a TA for a beginner programming course for students with little to no prior " \
"programming experience. Based on the provided question and answer, provide feedback on the student’s " \
"submission. You can provide feedback regarding things like simple logical inconsistencies, " \
"like unused variables or unreachable code, writing code once, and avoiding hard coding values " \
"but your priority is to ensure the student can successfully get the right output next time. " \
"If you provide code examples, make them different from the provided code while still " \
"communicating the same concept"

messages = [{'type': 'System Instructions', 'information': instructions}]
additionalInfo = ""

@app.route('/TAView')
def index():
  return render_template('index.html', messages=messages)

@app.route('/TAView/create', methods=['GET', 'POST'])
def create():
  global additionalInfo
  if request.method == 'POST':
        additionalInfo += request.form['content']
        content = request.form['content']
        if not content:
            flash('Content is required!')
        else:
            messages.append({'type': 'Addtional Information', 'information': content})
            return redirect(url_for('index'))

  return render_template('create.html')


@app.route('/', methods=['POST'])
def home():
  global question
  client = genai.Client(api_key=GEMINI_API_KEY)
  data = request.get_json()

  question = data['instructions']
  messages.append({'type':'Question','information': data['instructions']})

  studentAnswer = data['studentAnswer']
  messages.append({'type':'Student Answer', 'information': data['studentAnswer']})
  
  

  prompt = "Provide feedback for the code cound in studentAnswer given the above question. Provide the output in a markdown format"
  response = client.models.generate_content(
        model="gemini-2.5-flash",
        config={
          'system_instruction': instructions},
          contents=[
            studentAnswer,
            question,
            prompt,
            additionalInfo
          ],
      )

  return str(response.text)




if __name__ == '__main__':
    app.debug = True
    app.run()
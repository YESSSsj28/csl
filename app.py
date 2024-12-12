
from flask import Flask, request, jsonify, render_template_string
import time

app = Flask(__name__)

# HTML, CSS, and JavaScript combined in one script
html_template = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Google Proxy</title>
    <style>
        body {
            margin: 0;
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: black;
            color: white;
            font-family: Arial, sans-serif;
        }
        .container {
            text-align: center;
            background-color: purple;
            padding: 30px;
            border-radius: 10px;
        }
        .container input[type="text"] {
            padding: 10px;
            border: none;
            border-radius: 5px;
        }
        .container button {
            margin-top: 10px;
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            background-color: white;
            color: purple;
            cursor: pointer;
        }
        .container button:hover {
            background-color: lightgray;
        }
        .loading-container {
            display: none;
            text-align: center;
            background-color: darkblue;
            padding: 30px;
            border-radius: 10px;
        }
        .progress-bar {
            width: 100%; height: 10px; background-color: lightgray; margin-top: 20px; border-radius: 5px; overflow: hidden;
        }
        .progress-bar div {
            height: 100%; background-color: white; width: 0%;
        }
    </style>
</head>
<body>
    <div class="container" id="auth-container">
        <h1>Enter Key</h1>
        <input type="text" id="key" placeholder="Enter your key here" />
        <br />
        <button onclick="submitKey()">Submit</button>
    </div>
    <div class="loading-container" id="loading-container">
        <h1>Loading Google Proxy...</h1>
        <div class="progress-bar"><div id="progress"></div></div>
    </div>
    <script>
        function submitKey() {
            const key = document.getElementById('key').value;
            const authContainer = document.getElementById('auth-container');
            const loadingContainer = document.getElementById('loading-container');
            const progressBar = document.getElementById('progress');

            fetch('/proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ key })
            }).then(response => {
                if (response.ok) {
                    authContainer.style.display = 'none';
                    loadingContainer.style.display = 'block';

                    let progress = 0;
                    const interval = setInterval(() => {
                        progress += 5;
                        progressBar.style.width = progress + '%';
                        if (progress >= 100) {
                            clearInterval(interval);
                        }
                    }, 150); // 15 seconds to reach 100%
                } else {
                    alert('Invalid key. Try again.');
                }
            });
        }
    </script>
</body>
</html>
'''

@app.route('/')
def index():
    return html_template

@app.route('/proxy', methods=['POST'])
def proxy():
    key = request.form.get('key')
    if key != 'YUGISCOOL':
        return jsonify({'error': 'Invalid key'}), 401

    # Simulate loading time
    time.sleep(15)
    return jsonify({'message': 'Google Proxy is now ready!'})

if __name__ == '__main__':
    app.run(debug=True)

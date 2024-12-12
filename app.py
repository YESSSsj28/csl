from flask import Flask, request, redirect, render_template_string
import time

app = Flask(__name__)

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
            background-color: purple;
            color: white;
            font-family: Arial, sans-serif;
        }
        .container {
            text-align: center;
            background-color: #6a0dad;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        .container input[type="text"] {
            padding: 10px;
            border: none;
            border-radius: 15px;
            width: 80%;
            margin-bottom: 10px;
        }
        .container button {
            padding: 10px 20px;
            border: none;
            border-radius: 15px;
            background-color: white;
            color: #6a0dad;
            cursor: pointer;
        }
        .container button:hover {
            background-color: lightgray;
        }
        .loading-container {
            display: none;
            justify-content: center;
            align-items: center;
            height: 100vh;
            width: 100vw;
            position: absolute;
            top: 0;
            left: 0;
            background-color: purple;
        }
        .loading-text {
            color: transparent;
        }
        .half-image {
            width: 50%;
            height: 100vh;
            display: inline-block;
            background-size: cover;
            background-position: center;
        }
    </style>
</head>
<body>
    <div class="container" id="auth-container">
        <h1>What's the key?</h1>
        <input type="text" id="key" placeholder="Enter the key" />
        <br />
        <button onclick="submitKey()">Enter</button>
    </div>
    <div class="loading-container" id="loading-container">
        <div class="half-image" style="background-image: url('/static/your-first-image.png');"></div>
        <div class="half-image" style="background-image: url('/static/your-second-image.png');"></div>
        <div class="loading-text">Loading...</div>
    </div>
    <script>
        function submitKey() {
            const key = document.getElementById('key').value;
            if (key === 'Hiren611') {
                const authContainer = document.getElementById('auth-container');
                const loadingContainer = document.getElementById('loading-container');
                authContainer.style.display = 'none';
                loadingContainer.style.display = 'flex';
                setTimeout(() => {
                    window.location.href = '/proxy';
                }, 10000); // 10 seconds
            } else {
                alert('Invalid key. Try again.');
            }
        }
    </script>
</body>
</html>
'''

@app.route('/')
def index():
    return html_template

@app.route('/proxy')
def proxy():
    key = request.args.get('key')
    if key == 'Hiren611':
        response = requests.get('https://www.google.com')
        return response.content
    else:
        return 'Invalid key', 401

if __name__ == '__main__':
    app.run(debug=True)



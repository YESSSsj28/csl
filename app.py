from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

@app.route('/')
def home():
    return '''
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Yug's Proxy</title>
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
                .progress-bar-container {
                    width: 100%;
                    background-color: lightgray;
                    border-radius: 25px;
                    overflow: hidden;
                    margin-top: 20px;
                }
                .progress-bar {
                    height: 30px;
                    width: 0%;
                    background-color: white;
                    text-align: center;
                    line-height: 30px;
                    color: purple;
                    border-radius: 25px;
                }
                iframe {
                    width: 100%;
                    height: 90vh;
                    border: none;
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
                <h1>Loading Yug's Proxy...</h1>
                <div class="progress-bar-container">
                    <div class="progress-bar" id="progress-bar">0%</div>
                </div>
            </div>
            <div class="google-container" style="display: none;">
                <iframe src="/proxy?url=https://whoogle.thegpm.org" sandbox="allow-forms allow-scripts allow-same-origin"></iframe>
            </div>
            <script>
                function submitKey() {
                    const key = document.getElementById('key').value;
                    const authContainer = document.getElementById('auth-container');
                    const loadingContainer = document.getElementById('loading-container');
                    const progressBar = document.getElementById('progress-bar');

                    if (key === 'Hiren611') {
                        authContainer.style.display = 'none';
                        loadingContainer.style.display = 'flex';

                        let progress = 0;
                        const interval = setInterval(() => {
                            progress += 1;
                            progressBar.style.width = progress + '%';
                            progressBar.textContent = progress + '%';

                            if (progress >= 100) {
                                clearInterval(interval);
                                loadingContainer.style.display = 'none';
                                document.querySelector('.google-container').style.display = 'block';
                            }
                        }, 160); // Adjust this value to change the duration (160ms * 100 = 16 seconds)
                    } else {
                        alert('Invalid key. Try again.');
                    }
                }
            </script>
        </body>
        </html>
    '''

@app.route('/proxy')
def proxy():
    url = request.args.get('url')
    if not url:
        return 'Missing URL parameter', 400

    response = requests.get(url)
    excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
    headers = [(name, value) for (name, value) in response.raw.headers.items() if name.lower() not in excluded_headers]

    return response.content, response.status_code, headers

if __name__ == '__main__':
    app.run(debug=True)

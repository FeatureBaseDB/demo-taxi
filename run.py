from flask import Flask, Response
app = Flask(__name__)

@app.route('/')
def index():
    return open('index.html', 'r').read()

@app.route('/assets/main.js')
def js():
    return Response(open('assets/main.js', 'r').read(), mimetype='application/javascript')

@app.route('/assets/main.css')
def css():
    return Response(open('assets/main.css', 'r').read(), mimetype='text/css')

if __name__ == "__main__":
    app.run()

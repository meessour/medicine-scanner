const express = require('express');
const bodyParser = require('body-parser');
const enforce = require('express-sslify');
const tesseract = require('tesseract.js');
const multer = require('multer');
const fs = require('fs');

const app = express();
const http = require('http').Server(app);
const socketIo = require('socket.io')(http);

app.set('view engine', 'ejs')
    .set('views', 'views')
    .use(express.static('docs'))
    .use(bodyParser.json())
    .use(bodyParser.urlencoded({extended: true}))
;

// Enforce https when on Heroku
if (app.get("env") === "production") {
    app.use(enforce.HTTPS({trustProtoHeader: true}));
}

app.get('/', (req, res) => {
    res.render('index.ejs');
});

const port = 8080;

http.listen(port, () => {
    console.log("Server is listening on port", port);
});

const Storage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, __dirname + '/resources/snapshots');
    },
    filename: (req, file, callback) => {
        callback(null, file.originalname);
    }
});

const upload = multer({storage: Storage}).single('image');

socketIo.on('connection', (socket) => {
    console.log("A new client connected", socket.id)

    socket.on('upload', function (blob, response) {
        if (blob) {
            console.log("blob received")

            const imageName = `docs/resources/snapshots/${socket.id}.png`;

            fs.createWriteStream(imageName).write(blob);
        }
    });

    app.post('/upload', (req, res) => {
        const image = req.file;

        console.log("image", image);

        if (!image) throw "no image was uploaded";

        upload(req, res, err => {
            if (err) {
                console.log(err);
                return res.send('Something went wrong');
            }

            const image = fs.readFileSync(
                __dirname + '/resources/snapshots/' + req.file.originalname,
                {encoding: null}
            );

            tesseract.recognize(image)
                .progress(function (p) {
                    console.log('progress', p);
                })
                .then(function (result) {
                    console.log('done', result);
                    res.send(result.html);
                });
        });
    });

    socket.on('disconnecting', function () {
        console.log("A client disconnected", socket.id)
    });
});

const express = require('express');
const bodyParser = require('body-parser');
const enforce = require('express-sslify');
const tesseract = require('tesseract.js');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const tesseractScanner = require('./docs/js/tesseractScanner');

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

            const directory = `docs/resources/snapshots/`;
            // const imageName = `${directory}${socket.id}.png`;
            const imageName = `${directory}lol.png`;
            // const imageName = `lol.png`;

            // blobToImage(blob).then(function (result) {
            //     console.log('done', result);
            // }).catch(function (err) {
            //     console.log('err', err);
            // });

            try {


                const stream = fs.createWriteStream(imageName)

                stream.write(blob);

                // {
                //     "id": 0,
                //     "registrationNumber": "RVG  121312",
                //     "name": "18F-FDG Hoboken 250 MBq/ml, oplossing voor injectie",
                //     "activeIngredient": "V09IX04 - Fludeoxyglucose [18 F]"
                // }

                stream.on("ready", function (fd) {
                    console.log("done writing")
                    tesseractScanner(imageName).then(function (result) {
                        const registrationNumber = getRegistrationNumber(result)
                        const name = ''
                        const activeIngredient = ''

                        console.log("result:", registrationNumber);

                        // Send the medicine information back to the client
                        socket.emit('search-result', {
                            registrationNumber: registrationNumber,
                            name: name,
                            activeIngredient: activeIngredient,
                        });

                    }).finally(function () {
                        // Delete all the files in the snapshots directory
                        // fs.readdir(directory, (err, files) => {
                        //     if (err) throw err;
                        //
                        //     for (const file of files) {
                        //         fs.unlink(path.join(directory, file), err => {
                        //             if (err) throw err;
                        //         });
                        //     }
                        // });
                    })
                });
            } catch (e) {
                console.log(e)
            }
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


function getRegistrationNumber(string) {
    const rx = /\RVG(.*)/
    const arr = rx.exec(string);
    return arr ? arr[0] : '';
}

const express = require('express');
const bodyParser = require('body-parser');
const enforce = require('express-sslify');
const tesseract = require('tesseract.js');
const multer = require('multer');
const fs = require('fs');
const _ = require('lodash');
const path = require('path');

const tesseractScanner = require('./docs/js/tesseractScanner');

const medicineArrayPath = './docs/resources/medicineArray.json';
const medicineObjectPath = './docs/resources/medicineObject.json';

const medicineArray = require(medicineArrayPath);
let medicineObject;

try {
    medicineObject = require(medicineObjectPath);
} catch (e) {

}

// Run if new medicine data from API is available
// parseMedicineData();

/**
 * With this function all data is formatted in an object with objects identified by its key,
 * which is the registrationNumber
 *
 * Advantage is that it is not needed to iterate over whole array to find a specified id
 * https://stackoverflow.com/a/31470302
 */
function parseMedicineData() {
    let newMedicineObject = {};

    for (const medicineArrayElement of medicineArray) {
        // Get the registration number of the object, if it doesn't exist, continue to next in medicineArray
        let medicineArrayElementRegistrationNumber = medicineArrayElement.registrationNumber;
        if (!medicineArrayElementRegistrationNumber) continue;

        // Remove all whitespace and make the whole string uppercase
        medicineArrayElementRegistrationNumber =
            medicineArrayElementRegistrationNumber
                // https://stackoverflow.com/a/6623263 Coffeescript's way of interpretering regEx proof
                .replace(/\s+/g, '')
                .toUpperCase();

        const medicineArrayElementName = medicineArrayElement.name;
        const medicineArrayElementActiveIngredient = medicineArrayElement.activeIngredient;

        // Concat the name and activeIngredient to the already existing entry
        if (newMedicineObject[medicineArrayElementRegistrationNumber]) {
            let medicineObjectElementName = newMedicineObject[medicineArrayElementRegistrationNumber].name;
            const medicineElementNames = medicineObjectElementName.split('|');

            let medicineObjectElementActiveIngredient = newMedicineObject[medicineArrayElementRegistrationNumber].activeIngredient;
            const medicineElementActiveIngredient = medicineObjectElementActiveIngredient.split('|');

            // If a name of the duplicate medicine is not yet present,
            // concatenate it to the existing name with a pipe (|) between the names
            if (medicineElementNames.findIndex(item =>
                medicineArrayElementName.replace(/\s+/g, '').toLowerCase() ===
                item.replace(/\s+/g, '').toLowerCase()) === -1) {
                medicineObjectElementName += `|${medicineArrayElementName}`
            }

            // If a name of the duplicate medicine is not yet present,
            // concatenate it to the existing name with a pipe (|) between the names
            if (medicineElementActiveIngredient.findIndex(item =>
                medicineArrayElementActiveIngredient.replace(/\s+/g, '').toLowerCase() ===
                item.replace(/\s+/g, '').toLowerCase()) === -1) {
                medicineObjectElementActiveIngredient += `|${medicineArrayElementActiveIngredient}`
            }

            newMedicineObject[medicineArrayElementRegistrationNumber] = {
                name: medicineObjectElementName,
                activeIngredient: medicineObjectElementActiveIngredient
            }

            // console.log("duplicate found", medicineArrayElementRegistrationNumber);

        } else {
            newMedicineObject[medicineArrayElementRegistrationNumber] = {
                name: medicineArrayElementName,
                activeIngredient: medicineArrayElementActiveIngredient
            }
        }
    }

    console.log("medicineArray length", medicineArray.length)
    console.log("newMedicineObject length", Object.keys(newMedicineObject).length)
    console.log("medicineObject length", medicineObject ? Object.keys(medicineObject).length : undefined)
    console.log(_.isEqual(newMedicineObject, medicineObject))

    // If the original file's data changed compared to the new one, rewrite.
    // Originally made this check because of an infinite nodemon changes detected loop loop
    if (!_.isEqual(newMedicineObject, medicineObject)) {
        // Save the medicine object
        fs.writeFile(medicineObjectPath,
            JSON.stringify(newMedicineObject),
            'utf8',
            (err, data) => {
                if (err) console.log(err);
            });
    }
}

const app = express();
const http = require('http').Server(app);
const socketIo = require('socket.io')(http);

app.set('view engine', 'ejs')
    .set('views', 'views')
    .use(express.static('docs'))
    .use(bodyParser.json())
    .use(bodyParser.urlencoded({extended: true}));

// Enforce https when on Heroku
if (app.get("env") === "production") {
    app.use(enforce.HTTPS({trustProtoHeader: true}));
}

app.get('/', (req, res) => {
    res.render('index.ejs');
});

const port = process.env.PORT || 8080;

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
            const directory = `docs/resources/snapshots/`;
            const imageName = `${directory}${socket.id}.png`;

            try {
                const stream = fs.createWriteStream(imageName)

                // Only
                if (socket?.streamState?.closed === false) return

                socket.streamState = stream

                stream.write(blob);

                // "RVG121312": {
                //      "name": "18F-FDG Hoboken 250 MBq/ml, oplossing voor injectie",
                //      "activeIngredient": "V09IX04 - Fludeoxyglucose [18 F]"
                // }
                //
                // "RVH80505": {
                //      "name": "Tussilago petasites",
                //      "activeIngredient": ""
                // }
                //
                // "RVH80505": {
                //      "name":"Trulicity 0,75 mg oplossing voor injectie in voorgevulde injectiespuit|
                //          Trulicity 0,75 mg oplossing voor injectie in voorgevulde pen|
                //          Trulicity 1,5 mg oplossing voor injectie in voorgevulde injectiespuit|
                //          Trulicity 1,5 mg oplossing voor injectie in voorgevulde pen",
                //      "activeIngredient":"A10BJ05 - Dulaglutide"
                // }
                //
                // "EU/1/18/1310/001": {
                //      "name": "Deferiprone Lipomed 500 mg filmomhulde tabletten",
                //      "activeIngredient": "V03AC02 - Deferiprone"
                // }

                // All registration numbers start with either "RVG", "RVH" or "EU/" and end with a number
                // (RVG(\d+|\/)*|RVH(\d+|\/)|)
                // ((RVG(\d+|\/)+)|(RVH(\d+|\/)+)|(EU(\d+|\/)+)\d+)
                // (RVG\d+)|(RVH\d+)|(EU(\d+|\/)+)\d+

                stream.on("ready", function (fd) {
                    tesseractScanner(imageName).then(function (result) {

                        // console.log("result ###\n" + result + "\n$$$")

                        const registrationNumber = getRegistrationNumber(result);
                        console.log("registrationNumber:", registrationNumber);

                        if (!registrationNumber) return;

                        const medicineInformation = getMedicineInformation(registrationNumber)

                        if (registrationNumber && medicineInformation) {
                            console.log("medicine found!", medicineInformation)

                            // Send the medicine information back to the client
                            socket.emit('search-result', {
                                registrationNumber: getReadableRegistrationNumber(registrationNumber),
                                name: medicineInformation.name,
                                activeIngredient: medicineInformation.activeIngredient,
                            });
                        }

                    }).finally(function () {

                        try {
                            fs.unlink(imageName, err => {
                                if (err) throw err;
                            });
                        } catch (e) {
                            console.log("couldnt delete/find png")
                        }

                        // Delete all the files in the snapshots directory
                        // fs.readdir(directory, (err, files) => {
                        //     if (err) throw err;
                        //
                        //     fs.unlink(imageName, err => {
                        //         if (err) throw err;
                        //     });
                        //
                        //     // for (const file of files) {
                        //     //     fs.unlink(path.join(directory, imageName), err => {
                        //     //         if (err) throw err;
                        //     //     });
                        //     // }
                        // });
                        stream.end()
                    })

                });
            } catch (e) {
                console.log(e)
            }
        }
    });

    socket.on('get-medicine', function (registrationNumber, response) {
        if (!registrationNumber) return;

        const medicineInformation = getMedicineInformation(registrationNumber)

        if (registrationNumber && medicineInformation) {
            console.log("medicine found!", medicineInformation)

            // Send the medicine information back to the client
            socket.emit('search-result', [{
                registrationNumber: getReadableRegistrationNumber(registrationNumber),
                name: medicineInformation.name,
                activeIngredient: medicineInformation.activeIngredient,
            }]);
        }
    });

    socket.on('search-medicine', function (text, response) {
        if (!text) return;

        let results = findAllMatches(medicineArray, text)

        // Send the medicine information back to the client
        socket.emit('search-result', results);
    });

    socket.on('disconnecting', function () {
        console.log("A client disconnected", socket.id)
    });
});

/*
 * https://stackoverflow.com/a/10679620
 */
function findAllMatches(data, searchText) {
    try {
        const maxSearchResults = 20
        let results;

        searchText = searchText.toUpperCase();
        results = data.filter(function (entry) {
            if (entry &&
                entry.registrationNumber &&
                entry.registrationNumber.trim().replace(/ /g, '').toUpperCase().indexOf(searchText) !== -1)
                return true;

            if (entry &&
                entry.name &&
                entry.name.trim().replace(/ /g, '').toUpperCase().indexOf(searchText) !== -1)
                return true;

            if (entry &&
                entry.activeIngredient &&
                entry.activeIngredient.trim().replace(/ /g, '').toUpperCase().indexOf(searchText) !== -1)
                return true;
        });
        results.splice(maxSearchResults, results.length - 1)

        return results;
    } catch (e) {
        console.log(e)
        return;
    }
}

function parseMedicineResults(medicineArray) {
    if (!medicineArray || !medicineArray.length)
        return;

    // for (let i = 0; i < medicineArray.length; i++) {
    //     medicineArray[i] =  {
    //         registrationNumber: getReadableRegistrationNumber(medicineArray[i].registrationNumber),
    //             name
    //     :
    //         medicineInformation.name,
    //             activeIngredient
    //     :
    //         medicineInformation.activeIngredient,
    //     }
    // }
}

function getRegistrationNumber(string) {
    string = string ? string.trim().replace(/ /g, '') : string
    // RegEx for getting registration numbers starting with either "RVG", "RVH" or "EU/" and ending with a number
    const rx = /(RVG|RVH|EU\/)\d+(\d+|\/|\=)+/
    const arr = rx.exec(string);
    return arr ? arr[0] : undefined;
}

function getMedicineInformation(registrationNumber) {
    return medicineObject[registrationNumber]
}

function getReadableRegistrationNumber(registrationNumber) {
    return registrationNumber.replace(/RVG/g, 'RVG ').replace(/RVH/g, 'RVH ')
}
const http = require('http');
const fs = require('fs');

const myServer = http.createServer((req, res) => {
    const log = `New request received: ${req.method} ${req.url}\n`;

    fs.appendFile("exam.txt", log, (err) => {
        if (err) {
            console.error("Failed to write to file", err);
            res.statusCode = 500;
            return res.end("Internal Server Error");
        }

        console.log("New request recorded");
        res.end("Created a reference HTTP");
    });
});

myServer.listen(8000, () => {
    console.log("Server connected on port 8000");
});

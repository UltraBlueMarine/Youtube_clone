import express from "express";
import ffmpeg from "fluent-ffmpeg";
import { convertVideo, deleteProcessedVideo, deleteRawVideo, downloadRawVideo, setupDirectories, uploadProcessedFiles } from "./storage";
import { error } from "console";

setupDirectories();
const app = express();
app.use(express.json());

// Get the bucket and filename from the Cloud Pub/Sub msg
app.post("/process-video", async (req, res) => {
    let data;
    try{
        const msg = Buffer.from(req.body.message.data, 'base64').toString(`utf8`);
        data = JSON.parse(msg);
        if(!data.name){
            throw new Error(`Invalid msg payload received`);
        }
    }catch (error){
        console.error(error);
        return res.status(400).send(`Bad Request: missing filename`);

    }

    const inputFileName = data.name;
    const outputFileName = `processed-${inputFileName}`;
    await downloadRawVideo(inputFileName);

    try{
        await convertVideo(inputFileName, outputFileName);
    }catch(error){
        await Promise.all([
            deleteRawVideo(inputFileName),
            deleteProcessedVideo(outputFileName)
        ]);
        console.log(error);
        return res.status(500).send('Internal Error: video processing failed')

    }
    await uploadProcessedFiles(outputFileName);
    await Promise.all([
        deleteRawVideo(inputFileName),
        deleteProcessedVideo(outputFileName)
    ]);

    res.status(200).send('Video uploaded successefully');
    
});

const port = process.env.Port || 8080;
app.listen(port, () => {
    console.log(`server is running on port number: ${port}`);
});




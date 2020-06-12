require('dotenv').config();
const firebaseConfig = {
  apiKey: process.env.apiKey,
  authDomain: process.env.authDomain,
  databaseURL: process.env.databaseURL,
  projectId: process.env.projectId,
  storageBucket: process.env.storageBucket,
  messagingSenderId: process.env.messagingSenderId,
  appId: process.env.appId,
  measurementId: process.env.measurementId
};  
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(firebaseConfig);

const fetch = require('node-fetch');
const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json({limit: '1mb'}));

/*
app.get("/usgs-data-live/st-joseph-basin/", async (req, res) => {
        //5-27 pulling from all availble gage stations in St Joe Basin, returning JSON with current and daily stats
        const currentFlow = async function () {
            const sta_list = ["04096405","04096515","04097500","040975299","04097540","04099000","04100500","04101000","04101500","04101535","04101800","04102500"];
            //mainstem only - const sta_list = ["04096405","04097500","04099000","04101000","04101500"];
            const urlStart = 'https://waterservices.usgs.gov/nwis/iv/?format=json&sites=', urlEnd = '&parameterCd=00060,00065&siteStatus=all';
            let gageObject = {}, gageList = [];
            for (i = 0; i < sta_list.length; i++) {
                const api_url = (urlStart + sta_list[i] + urlEnd);               
                const response = await fetch(api_url);
                const data = await response.json();
                const sta_data = data.value, sta_flow = sta_data.timeSeries[0], sta_gage = sta_data.timeSeries[1], sta_flow_val = sta_flow.values[0].value[0].value;
                gageObject = {siteName: sta_flow.sourceInfo.siteName, siteCode: sta_flow.sourceInfo.siteCode[0].value, 
                            siteFlow: Number(sta_flow.values[0].value[0].value), gageHeight: Number(sta_gage.values[0].value[0].value),
                            dateTime: sta_flow.values[0].value[0].dateTime, gageStatus:"", gagePercent:""};
                gageList[i] = gageObject;
            };
            return gageList;
        };  
    const gageStatus = async function (stationList) {
        //refactoring array into object for ease of station referencing on frontend
        const stationData = {};
        for (z in stationList) {
            //generate url params using USGS siteCode from stationObject
            // const urlStart = 'https://waterservices.usgs.gov/nwis/stat/?format=rdb&sites=', urlEnd = '&statReportType=daily&statTypeCd=all';
            // https://waterservices.usgs.gov/nwis/stat/?format=rdb&sites=04101500&statReportType=daily&statTypeCd=all&parameterCd=00060
            const urlStart = 'https://waterservices.usgs.gov/nwis/stat/?format=rdb&sites=', urlEnd = '&statReportType=daily&statTypeCd=all&parameterCd=00060';
            const api_url = (urlStart + stationList[z].siteCode + urlEnd);               
            console.log(api_url);
            const fetchData = await fetch(api_url);
            const dataText = await fetchData.text();
            const dataLines = dataText.split("\n");
            let dailyMean = 0, dailyStats = {"mean":0};
            //Need to find todays date to compare current discharge level against
            const today = new Date(), monthNum = (today.getMonth() + 1), dayNum = today.getDate(), yearNum = today.getFullYear();
            //console.log("Today's Date: " + monthNum + "-" + dayNum + "-" + yearNum);
            const usgsLabels = {"p05":'LOW', "p10":'MUCH BELOW NORMAL', "p20":'BELOW NORMAL', "p25":'BELOW NORMAL', 
                "p50":'NORMAL', "p75": 'NORMAL', "p80":'ABOVE NORMAL', "p90":'ABOVE NORMAL', "p95":'MUCH ABOVE NORMAL'};
                //start at the January 1st to match date to today's date, line 50 in the tab separated text file
            for (x=49;dailyStats.mean==0;x++) {
                const dataTabs = dataLines[x].split("\t");
                dailyStats.mean = (dataTabs[5] == monthNum && dataTabs[6] == dayNum) ? (dataTabs[14]) : 0;
                dailyStats.mean != 0 ? (dailyStats = {"mon":dataTabs[5],"day":dataTabs[6], "maxYear": dataTabs[10], "maxFlow": dataTabs[11], 
                "minYear": dataTabs[12], "minFlow": dataTabs[13], "mean": dataTabs[14], "p05": dataTabs[15], "p10": dataTabs[16], 
                "p20": dataTabs[17], "p25": dataTabs[18], "p50":dataTabs[19], "p75":dataTabs[20],"p80":dataTabs[21],"p90":dataTabs[22],"p95":dataTabs[23]}):"";
            };
            //find percentile current flow 
            for (x=7;x<Object.entries(dailyStats).length;x++) {
                stationList[z].siteFlow >= Object.entries(dailyStats)[x][1]? (stationList[z].gagePercent = Object.entries(dailyStats)[x][0],
                stationList[z].gageStatus = usgsLabels[stationList[z].gagePercent]):"";
            }
            const stationRecord = {"ID": stationList[z].siteCode, "stationInfo": stationList[z], "dailyStats": dailyStats};
            stationData[stationRecord.ID] = stationRecord;
        };
        return stationData;
    };    
    
    try {
        const flowStatus = await currentFlow();
        const stationStatus = await gageStatus(flowStatus);
        res
        .status(200)
        .send(stationStatus);
    }
    catch (err) {
        console.error("FAILer TO GET WATER DATA");
        res
        .status(400)
        .send('ERROR MESSAGE FAILED TO FETCH USGS DATA ST JOSEPH RIVER');
    }
});
*/
//Updated send paramater via endpoint /sta_id1,sta_id2,etc... 
//Works great!
app.get("/usgs-data-live/st-joseph-basin/:stationlist", async (req, res) => {
    console.log(req.params.stationlist);
    const sta_list = req.params.stationlist.split(',');
    console.log(sta_list);
    //5-27 pulling from all availble gage stations in St Joe Basin, returning JSON with current and daily stats
    const currentFlow = async function () {
        //all stations - const sta_list = ["04096405","04096515","04097500","040975299","04097540","04099000","04100500","04101000","04101500","04101535","04101800","04102500"];
        //mainstem only - const sta_list = ["04096405","04097500","04099000","04101000","04101500"];
        const urlStart = 'https://waterservices.usgs.gov/nwis/iv/?format=json&sites=', urlEnd = '&parameterCd=00060,00065&siteStatus=all';
        let gageObject = {}, gageList = [];
        for (i = 0; i < sta_list.length; i++) {
            const api_url = (urlStart + sta_list[i] + urlEnd);               
            const response = await fetch(api_url);
            const data = await response.json();
            const sta_data = data.value, sta_flow = sta_data.timeSeries[0], sta_gage = sta_data.timeSeries[1], sta_flow_val = sta_flow.values[0].value[0].value;
            gageObject = {siteName: sta_flow.sourceInfo.siteName, siteCode: sta_flow.sourceInfo.siteCode[0].value, 
                        siteFlow: Number(sta_flow.values[0].value[0].value), gageHeight: Number(sta_gage.values[0].value[0].value),
                        dateTime: sta_flow.values[0].value[0].dateTime, gageStatus:"", gagePercent:""};
            gageList[i] = gageObject;
        };
        return gageList;
    };  
const gageStatus = async function (stationList) {
    //refactoring array into object for ease of station referencing on frontend
    const stationData = {};
    for (z in stationList) {
        //generate url params using USGS siteCode from stationObject
        // const urlStart = 'https://waterservices.usgs.gov/nwis/stat/?format=rdb&sites=', urlEnd = '&statReportType=daily&statTypeCd=all';
        // https://waterservices.usgs.gov/nwis/stat/?format=rdb&sites=04101500&statReportType=daily&statTypeCd=all&parameterCd=00060
        const urlStart = 'https://waterservices.usgs.gov/nwis/stat/?format=rdb&sites=', urlEnd = '&statReportType=daily&statTypeCd=all&parameterCd=00060';
        const api_url = (urlStart + stationList[z].siteCode + urlEnd);               
        console.log(api_url);
        const fetchData = await fetch(api_url);
        const dataText = await fetchData.text();
        const dataLines = dataText.split("\n");
        let dailyMean = 0, dailyStats = {"mean":0};
        //Need to find todays date to compare current discharge level against
        const today = new Date(), monthNum = (today.getMonth() + 1), dayNum = today.getDate(), yearNum = today.getFullYear();
        //console.log("Today's Date: " + monthNum + "-" + dayNum + "-" + yearNum);
        const usgsLabels = {"p05":'LOW', "p10":'MUCH BELOW NORMAL', "p20":'BELOW NORMAL', "p25":'BELOW NORMAL', 
            "p50":'NORMAL', "p75": 'NORMAL', "p80":'ABOVE NORMAL', "p90":'ABOVE NORMAL', "p95":'MUCH ABOVE NORMAL'};
            //start at the January 1st to match date to today's date, line 50 in the tab separated text file
        for (x=49;dailyStats.mean==0;x++) {
            const dataTabs = dataLines[x].split("\t");
            dailyStats.mean = (dataTabs[5] == monthNum && dataTabs[6] == dayNum) ? (dataTabs[14]) : 0;
            dailyStats.mean != 0 ? (dailyStats = {"mon":dataTabs[5],"day":dataTabs[6], "maxYear": dataTabs[10], "maxFlow": dataTabs[11], 
            "minYear": dataTabs[12], "minFlow": dataTabs[13], "mean": dataTabs[14], "p05": dataTabs[15], "p10": dataTabs[16], 
            "p20": dataTabs[17], "p25": dataTabs[18], "p50":dataTabs[19], "p75":dataTabs[20],"p80":dataTabs[21],"p90":dataTabs[22],"p95":dataTabs[23]}):"";
        };
        //find percentile current flow 
        for (x=7;x<Object.entries(dailyStats).length;x++) {
            stationList[z].siteFlow >= Object.entries(dailyStats)[x][1]? (stationList[z].gagePercent = Object.entries(dailyStats)[x][0],
            stationList[z].gageStatus = usgsLabels[stationList[z].gagePercent]):"";
        }
        const stationRecord = {"ID": stationList[z].siteCode, "stationInfo": stationList[z], "dailyStats": dailyStats};
        stationData[stationRecord.ID] = stationRecord;
    };
    return stationData;
};    

try {
    const flowStatus = await currentFlow();
    const stationStatus = await gageStatus(flowStatus);
    res
    .status(200)
    .send(stationStatus);
}
catch (err) {
    console.error("FAILer TO GET WATER DATA");
    res
    .status(400)
    .send('ERROR MESSAGE FAILED TO FETCH USGS DATA ST JOSEPH RIVER');
}
});


exports.api = functions.runWith({ memory: '2GB' }).https.onRequest(app);
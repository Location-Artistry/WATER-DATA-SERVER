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

class Feature {
    constructor(id) {
      this.type = 'Feature';
      this.properties = {'ID':id,'label':'','info':'','status':'','val':-1,'units':''};
    }
    id() {return this.properties.ID}
    info() {return this.properties}
    addProp(name,value) {
      try {
        this.properties[name] = value;
        return (`${name}: ${value} added to Feature ID: ${this.id()}`); }
      catch { (`Could NOT add ${name}: ${value}!`) }
    }
    addProps(arr) {
      try { arr.forEach(d => this.properties[d[0]] = d[1])}
      catch { return (`Could NOT add ${arr} to ${this.id()}`) }
    }
  };
  class GeoPoint extends Feature {
    constructor(id,[lon,lat],props = {}) {
      super(id);
      this.properties.EPSG = 4326, this.properties.source = '', this.properties.crs = 'WGS 84';
      this.geometry = {'type':'Point','coordinates':[lon,lat]};
      Object.entries(props).forEach(([d,i]) => (this.properties[d] = i));
    }  
    geo() {return this.geometry.coordinates}
    crs() {return [(`EPSG:${this.properties.EPSG}`),this.properties.crs]}
  };
  class FeatureCollection {
    constructor(meta) {
      this.type = 'FeatureCollection';
      this.metadata = meta;
      this.features = [];
    }
    geoType() { try {return this.features[0].geometry.type}
                catch {return "It doesn't appear their are any features yet..."} }
    fCount() {return this.features.length};
    fProps() {try {return this.features[0].properties}
                catch {return "It doesn't appear their are any features yet..."} }
    fPush(feature) {
      try { this.features.push(feature);
        return `Added Feature Number ${this.fCount()}`; }
      catch { return "Cannot add ${feature} to Feature Collection"} }
  };

// working on new cloud function to convert USGS Gage data into GeoJSON endpoint
app.get("/usgs-data-live/gageGeo/:stationlist", async (req, res) => {
    
    const stationData = async(stations) => {
        const urlStart = 'https://waterservices.usgs.gov/nwis/iv/?format=json&sites=', urlEnd = '&parameterCd=00060,00065&siteStatus=all';
        let gageData = {}, gageList = [];    
        for(z of stations) {
          const rawData = await fetch(`${urlStart}${z}${urlEnd}`);
          const data = await rawData.json();
          const {sourceInfo,values,variable} = data.value.timeSeries[0];
          const {sourceInfo: sourceInfo2, values: values2, variable: variable2} = data.value.timeSeries[1];
          gageData = {siteName: sourceInfo.siteName, siteCode: sourceInfo.siteCode[0].value, siteFlow: Number(values[0].value[0].value), flowUnits: variable.unit.unitCode, gageHeight: Number(values2[0].value[0].value), heightUnits: variable2.unit.unitCode, dateTime: values[0].value[0].dateTime, huc: sourceInfo.siteProperty[1].value, lat: Number(sourceInfo.geoLocation.geogLocation.latitude), lon: Number(sourceInfo.geoLocation.geogLocation.longitude), crs: sourceInfo.geoLocation.geogLocation.srs };
          gageList.push(gageData);
        }
        return gageList;
      };
      
      const stationStatus = async(stationList) => {
        let stationArr = [];
        for (z in stationList) {
          const urlStart = 'https://waterservices.usgs.gov/nwis/stat/?format=rdb&sites=', urlEnd = '&statReportType=daily&statTypeCd=all&parameterCd=00060';
          
          const rawData = await fetch(`${urlStart}${stationList[z].siteCode}${urlEnd}`);
          const dataLines = (await rawData.text()).split("\n");
          let dailyMean = 0, dailyStats = {"mean":0};
          //Need to find todays date to compare current discharge level against
          const today = new Date(), monthNum = (today.getMonth() + 1), dayNum = today.getDate(), yearNum = today.getFullYear();
          const usgsLabels = {"p05":'LOW', "p10":'MUCH BELOW NORMAL', "p20":'BELOW NORMAL', "p25":'BELOW NORMAL', 
                  "p50":'NORMAL', "p75": 'NORMAL', "p80":'ABOVE NORMAL', "p90":'ABOVE NORMAL', "p95":'MUCH ABOVE NORMAL'};
          //start at the January 1st to match date to today's date, line 50 in the tab separated text file
          for (x=49;dailyStats.mean==0;x++) {
            const dataTabs = dataLines[x].split("\t");
            dailyStats.mean = (dataTabs[5] == monthNum && dataTabs[6] == dayNum) ? (dataTabs[14]) : 0;
            dailyStats.mean != 0 ? (dailyStats = {"mon":dataTabs[5],"day":dataTabs[6], "maxYear": dataTabs[10], "maxFlow": dataTabs[11], "minYear": dataTabs[12], "minFlow": dataTabs[13], "mean": dataTabs[14], "p05": dataTabs[15], "p10": dataTabs[16], "p20": dataTabs[17], "p25": dataTabs[18], "p50":dataTabs[19], "p75":dataTabs[20], "p80":dataTabs[21], "p90":dataTabs[22], "p95":dataTabs[23]}):""};
              //find percentile current flow 
              for (x=7;x<Object.entries(dailyStats).length;x++) {
                  stationList[z].siteFlow >= Object.entries(dailyStats)[x][1]? (stationList[z].gagePercent = Object.entries(dailyStats)[x][0],
                  stationList[z].gageStatus = usgsLabels[stationList[z].gagePercent]):"";
              }
              const stationRecord = {"ID": stationList[z].siteCode, "stationInfo": stationList[z], "dailyStats": dailyStats};
              //stationData[stationRecord.ID] = stationRecord;
          stationArr.push(stationRecord);
        };
        return stationArr;
      };

      const stationGeoJSON = async (data) => {
        const geo = new FeatureCollection('USGS Gaging Stations and Status for the St. Joeseph River, MI - Code by https://github.com/Nottawaseppi');
        data.forEach(d => {
          const gp = new GeoPoint(d.ID,[d.stationInfo.lon,d.stationInfo.lat],d);
          [gp.properties.source,gp.properties.info,gp.properties.status] = ['USGS/NHBP',d.stationInfo.siteName, d.stationInfo.gageStatus];
          geo.fPush(gp);
        });
        return geo;
      };
        
    try {
        // functions declared above, buisness logic here
        const stations = req.params.stationlist.split(',');
        const stationInfo = await stationData(stations);
        const statusData = await stationStatus(stationInfo);
        const stationGeo = await stationGeoJSON(statusData);
        res
        .set('Access-Control-Allow-Origin', '*')
        .status(200)
        .send(stationGeo);
    }
    catch (err) {
        console.error("FAILer TO GET WATER DATA");
        res
        .status(400)
        .send('ERROR MESSAGE FAILED TO FETCH USGS GAGE DATA');
    }
});

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
        //console.log("Today's Date: " + monthNum + "-" + dayNum + "-" + yearNum);
        console.log(api_url);
        const fetchData = await fetch(api_url);
        const dataText = await fetchData.text();
        const dataLines = dataText.split("\n");
        let dailyMean = 0, dailyStats = {"mean":0};
        //Need to find todays date to compare current discharge level against
        const today = new Date(), monthNum = (today.getMonth() + 1), dayNum = today.getDate(), yearNum = today.getFullYear();
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
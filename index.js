var axios = require('axios');
var CronJob = require('cron').CronJob;
var rancherHost = process.env.RANCHERHOST;
var key = process.env.KEY;
var secret = process.env.SECRET;
var token = 'Basic ' + new Buffer(`${key}:${secret}`).toString('base64');
var envId = process.env.ENVID;
var slackApi = process.env.SLACKAPI;
var sendResolve = (process.env.SENDRESOLVE) ? (process.env.SENDRESOLVE) : 0;
var log = (process.env.LOG) ? (process.env.LOG) : 0;
var checkTimes =(process.env.CHECKTIMES) ? (process.env.CHECKTIMES) : 3;
var apiVersion = (process.env.APIVERSION) ? (process.env.APIVERSION) : 'v2-beta';
var hostList = (process.env.HOSTLIST) ? (process.env.HOSTLIST) : '';
var hostArray = (hostList && hostList != '') ? hostList.split(',') : [];
var cpuLimit = (process.env.CPULIMIT) ? (process.env.CPULIMIT) : 90;
var memLimit = (process.env.MEMLIMIT) ? (process.env.MEMLIMIT) : 90;
var diskLimit = (process.env.DISKLIMIT) ? (process.env.DISKLIMIT) : 90;
var cronTime = (process.env.CRONTIME) ? (process.env.CRONTIME) : '1 * * * * *';
var notifyList = {};

var options = {
  rancherHost: rancherHost,
  key: key,
  secret: secret,
  envId: envId,
  slackApi: slackApi,
  hostArray: hostArray,
  cpuLimit: cpuLimit,
  memLimit: memLimit,
  diskLimit: diskLimit,
  cronTime: cronTime,
  log:log,
  sendResolve:sendResolve,
  checkTimes:checkTimes
}

var api = axios.create({
  baseURL: `${rancherHost}/${apiVersion}/projects/${envId}/hosts`,
  headers: {
    'cache-control': 'no-cache',
    'Authorization': token
  }
});

function getHostInfo(hostid) {
  return new Promise(function(resolve, reject) {
    api.get(`/${hostid}`).then(function(res) {
      var hostid = res.data.id;
      var hostname = res.data.hostname;
      var mem = res.data.info.memoryInfo;
      var disk = res.data.info.diskInfo.mountPoints['/dev/sda1'];
      var cpu = res.data.info.cpuInfo;
      var diskUsage = disk.percentage.toFixed(2);
      var memUsage = ((mem.active / mem.memTotal) * 100).toFixed(2);
      var cpuUsage = (cpu.cpuCoresPercentages[0]).toFixed(2);
      var result = {
        hostid: hostid,
        hostname: hostname,
        cpuUsage: cpuUsage,
        memUsage: memUsage,
        diskUsage: diskUsage
      }
      resolve(result);
    }).catch(function(err) {
      reject(err);
    });
  });
}

function check() {
  getHostInfo().then(function(result) {
    for (var i in result) {
      var warnMsg = `Hey <!here>!\n Host \`${result[i].hostname}\` is under high load!\n`;
      var warning = 0;
      var msg = `Hey <!here>!\n Host \`${result[i].hostname}\` back to normal!\n`;
      msg += `The max CPU usage in last 1 min is \`${result[i].cpuUsage}%\`!\n`;
      msg += `The max Memory usage in last 1 min is \`${result[i].memUsage}%\`!\n`;
      msg += `Disk usage is \`${result[i].diskUsage}%\`!`;
      if (result[i].cpuUsage > cpuLimit) {
        warnMsg += `The max CPU usage in last 1 min is over \`${cpuLimit}%\`, value is \`${result[i].cpuUsage}%\`!\n`;
        warning = 1;
      }
      if (result[i].memUsage > memLimit) {
        warnMsg += `The max Memory usage in last 1 min is over \`${memLimit}%\`, value is \`${result[i].memUsage}%\`!\n`;
        warning = 1;
      }
      if (result[i].diskUsage > diskLimit) {
        warnMsg += `Disk usage over \`${diskLimit}%\`, now usage \`${result[i].diskUsage}%\`!`;
        warning = 1;
      }
      if (log) console.log(result[i]);
      if (warning) {
        notifyList[result[i].hostid] += 1;
        if ((notifyList[result[i].hostid] == checkTimes) && slackApi) {
          sendSlackMsg(warnMsg);
        }
      } else {
        if (notifyList[result[i].hostid] >= checkTimes && slackApi && sendResolve) {
          sendSlackMsg(msg);
        }
        notifyList[result[i].hostid] = 0;
      }
    }
  }).catch(function(err) {
    console.log(err);
  });
}

function sendSlackMsg(msg) {
  axios.post(slackApi, {
    'text': msg
  });
}

for (var i in hostArray) {
  notifyList[hostArray[i]] = 0;
}

console.log(options);

if (!key || !secret || !envId || !rancherHost) {
  console.log('缺少參數!');
} else {
  new CronJob({
    cronTime: cronTime,
    onTick: function() {
      console.log('check');
      check();
    },
    start: true,
    timeZone: 'Asia/Taipei'
  });
}

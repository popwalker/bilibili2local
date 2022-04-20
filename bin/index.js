#!/usr/bin/env node

const inquirer = require('inquirer');
const chalk = require('chalk');
const parseUrl = require('parse-url');
const { default: axios } = require('axios');
const download = require('../utils/download.js');
const ProgressBar = require('progress');
const { Command } = require('commander');
const path = require('path');
const program = new Command();
const pkgConfig = require('../package.json');

let options;

async function start() {
  options = program.opts();
  let uri = options.uri;
  if (!uri) {
    const { inputUri } = await inquirer.prompt([
      {
        type: 'input',
        message: '请输入url\n',
        name: 'inputUri'
      }
    ]);
    uri = inputUri;
  }
  const urlObj = parseUrl(uri);
  const bv = getBv(urlObj.pathname);
  await downloadMultiVideo(bv, urlObj);
  process.exit(0);
}

async function downloadMultiVideo(bv, urlObj) {
  // 获取分p信息
  const resultData = await axios.get(`http://api.bilibili.com/x/player/pagelist?bvid=${bv}`);
  const list = resultData.data.data;
  let pageRange = options.range;
  if (list.length > 1 && !pageRange) {
    const { inputPageRange } = await inquirer.prompt([
      {
        type: 'input',
        message: `请输入下载范围 (页码${list[0].page}~${list[list.length - 1].page}, 格式为 start,end )\n`,
        name: 'inputPageRange'
      }
    ]);
    pageRange = inputPageRange;
  }
  if (list.length > 1) {
    const range = pageRange.split(',');
    const downloadList = list.filter(item => item.page >= range[0] && item.page <= range[1]);
    await downloadVideo(bv, urlObj, downloadList, 0);
  } else {
    await downloadVideo(bv, urlObj, list, 0);
  }
}

// 递归下载
async function downloadVideo(bv, urlObj, list, index) {
  const target = list[index];
  const videoSource = await axios.get(`https://api.bilibili.com/x/player/playurl?bvid=${bv}&cid=${target.cid}&qn=112`);
  const downloadUrl = videoSource.data.data.durl[0].url;
  console.log(chalk.blue(`开始下载 ${target.page}_${target.part}`));
  let bar;
  await download(downloadUrl, path.resolve('./', options.output || 'dist'), {
    filename: `${target.page}_${target.part}.flv`,
    headers: {
      origin: `${urlObj.protocol}://${urlObj.resource}`,
      referer: urlObj.href,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.82 Safari/537.36'
    },
    /**
     * 下载进度回调
     * @param {{ percent: number; transferred: number; total: number; }} param0 
     */
    onDownloadProgress({ percent, total }) {
      if (!bar) {
        bar = new ProgressBar(`下载进度: [:bar] :rate/bps :percent :etas`, {
          width: 50,
          total: total,
          renderThrottle: 500
        });
      }
      bar.update(percent);
    }
  });
  if (list[index + 1]) {
    await downloadVideo(bv, urlObj, list, index + 1);
  } else {
    console.log(chalk.green('视频已经下载完毕！！！'));
  }
}

function getBv(pathname) {
  let bv = null;
  if (pathname.indexOf("/medialist/play/watchlater/") != -1) { // 在下载视频的时候针对稍后再看页面的链接找BV号
    bv = pathname.replace("/medialist/play/watchlater/", "").replace("/", "");
  } else {
    bv = pathname.replace("/video/", "").replace("/", "");
  }
  if (!bv) {
    console.log(chalk.red('获取bv失败'));
    process.exit(1);
  }
  return bv;
}

program
  .version(pkgConfig.version)
  .option('-v, --version', '查看版本号')
  .option('-u, --uri <type>', 'bilibili多p视频uri')
  .option('-r, --range <type>', '下载范围 例下载第三集到第三十集(包含): 3,30')
  .option('-o, --output <type>', '输出文件夹，默认为dist')
  .description('前端组件模版初始化工具，快速生成模版代码')
  .action(start);
program.parse(process.argv);
// create的所有逻辑
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const ora = require("ora");
const Inquirer = require("inquirer");

const { downloadDirectory } = require("./constants");
const { promisify } = require("util");
let downloadGitRepo = require("download-git-repo");
// 可以把异步的api转化成promise
downloadGitRepo = promisify(downloadGitRepo);
let ncp = require("ncp");
ncp = promisify(ncp);
// 遍历文件夹，看看需不需要渲染
const MetalSmith = require("metalsmith");
// consolidate统一了所有的模板引擎
let { render } = require("consolidate").ejs;
render = promisify(render);
// create功能是创建项目
// 拉取所有模板项目列出来 让用户选择
// https://api.github.com/orgs/zhu-cli/repos 获取组织下的仓库
// 选择项目后 再显示所有版本号
// 可能还需要用户配置一些数据 来结合渲染模板项目

// 获取项目列表
const getRepoList = async () => {
  const { data } = await axios.get("https://api.github.com/orgs/zhu-cli/repos");
  return data;
};
// 获取版本列表
const getTagList = async repo => {
  const { data } = await axios.get(
    `https://api.github.com/repos/zhu-cli/${repo}/tags`
  );
  return data;
};
// 封装loading效果
const waitFnLoading = (fn, message) => async (...args) => {
  const spinner = ora(message);
  spinner.start();
  const result = await fn(...args);
  spinner.succeed();
  return result;
};
// 下载模板
const download = async (repo, tag) => {
  let url = `zhu-cli/${repo}`;
  if (tag) {
    url += `#${tag}`;
  }
  let dest = downloadDirectory + "/" + repo;
  await downloadGitRepo(url, dest);
  return dest; // 下载的最终目录
};
module.exports = async projectName => {
  // 1) 获取项目的模板
  let repos = await waitFnLoading(getRepoList, "download template...")();
  repos = repos.map(repo => repo.name);

  // 获取之前 显示loading 若成功 关闭loading 显示成功 若失败，关闭loading 显示失败
  // 选择模板 inquirer
  const { repo } = await Inquirer.prompt({
    name: "repo",
    type: "list",
    message: "please choice a template to create porject",
    choices: repos
  });

  // 2) 通过当前选择的项目 拉取对应的版本
  // 获取对应的版本号 https://api.github.com/repos/zhu-cli/vue-simple-template/tags
  let tags = await waitFnLoading(getTagList, "download tags...")(repo);
  tags = tags.map(item => item.name);

  const { tag } = await Inquirer.prompt({
    name: "tag",
    type: "list",
    message: "please choice tags to create porject",
    choices: tags
  });
  // 下载模板
  // 3) 把模板放到一个临时目录里 以备后期使用
  // download-git-repo
  const result = await waitFnLoading(download, "download template ...")(
    repo,
    tag
  );

  // 简单的：拿到下载目录后，直接将模板拷贝到当前执行的目录下即可 ncp
  // 把template下的文件拷贝到执行命令的目录下
  // 4) 拷贝操作
  // 判断此项目名称是否在当前目录存在，若存在，提示：已存在，若不存在，直接拷贝
  // 如果有ask.js文件

  if (!fs.existsSync(path.join(result, "ask.js"))) {
    await ncp(result, path.resolve(projectName));
  } else {
    // 复杂的：需要模板渲染 渲染后再进行拷贝
    // 把git上的项目下载下来， 如果有ask文件就是一个复杂的模板，我们需要用户选择，选择后编译模板
    // 1) 让用户填写信息
    // 2) 用用户填写的信息渲染模板
    // metalsmith 只要是模板编译， 都需要这个模块
    await new Promise((resolve, reject) => {
      MetalSmith(__dirname) // 如果传入路径，会默认遍历当前路径下的src文件夹
        .source(result)
        .destination(path.resolve(projectName))
        .use(async (files, metal, done) => {
          const args = require(path.join(result, "ask.js"));
          let userConfig = await Inquirer.prompt(args);
          const meta = metal.metadata();
          Object.assign(meta, userConfig);
          delete files["ask.js"];
          done();
        })
        .use((files, metal, done) => {
          let userConfig = metal.metadata();
          Reflect.ownKeys(files).forEach(async file => {
            if (file.includes("js" || file.includes("json"))) {
              let content = files[file].contents.toString(); // 文件的内容
              if (content.includes("<%")) {
                content = await render(content, userConfig);
                files[file].contents = Buffer.from(content); // 渲染
              }
            }
          });
          done();
        })
        .build(err => {
          if (err) {
            reject();
          } else {
            resolve();
          }
        });
    });
  }
};

const path = require("path");
// 找到要执行的核心文件
// 要解析用户的参数
const program = require("commander");
const { version } = require("./constants");

const mapAction = {
  create: {
    alias: "c",
    description: "create a project",
    examples: ["duo-cli create <project-name>"]
  },
  config: {
    alias: "conf",
    description: "config project variable",
    examples: ["duo-cli config set <k> <v>", "duo-cli config get <k>"]
  },
  "*": {
    alias: "",
    description: "command not found",
    examples: []
  }
};
Reflect.ownKeys(mapAction).forEach(action => {
  program
    .command(action) // 配置命令的名称
    .alias(mapAction[action].alias) // 命令的别名
    .description(mapAction[action].description) // 命令对应的描述
    .action(() => {
      // 访问不到对应的命令 就打印找不到命令
      if (action === "*") {
        console.log(mapAction[action].description);
      } else {
        // console.log(action); // create config ...
        // duo-cli create xxx // [node, duo-cli, create, xxx]
        require(path.resolve(__dirname, action))(...process.argv.slice(3));
      }
    });
});
program.on("--help", function() {
  console.log("\nExamples:");
  Reflect.ownKeys(mapAction).forEach(action => {
    mapAction[action].examples.forEach(example => {
      console.log(`  ${example}`);
    });
  });
});
// 解析用户传递过来的参数
program.version(version).parse(process.argv);

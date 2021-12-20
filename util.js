const childProcess = require("child_process")
const fs = require('fs')
const path = require('path');

/**
 * 判断是否存在
 * @param path 文件地址
 * @returns {boolean}
 */
function exists(path) {
    return fs.existsSync(path);
}

/**
 * 判断是否是文件
 * @param path 文件地址
 * @returns {boolean}
 */
function isFile(path) {
    return exists(path) && fs.statSync(path).isFile();
}

/**
 * 递归复制文件夹-同步(不覆盖重名文件)
 * @param from 要复制的文件夹
 * @param to 复制到的位置
 * @param shroud 是否覆盖
 */
function copyFolderSync(from, to, shroud) {
    if (shroud === undefined) {
        shroud = false
    }
    from = path.join(from)
    to = path.join(to)
    if (!exists(to)) {
        if (isFile(from)) {
            fs.mkdirSync(path.resolve(path.join(to), '..'), {recursive: true});
        } else {
            fs.mkdirSync(to, {recursive: true});
        }
    }
    fs.readdirSync(from).forEach(element => {
        if (isFile(path.join(from, element))) {
            if (!exists(path.join(to, element)) || shroud) {
                fs.copyFileSync(path.join(from, element), path.join(to, element));
            }
        } else {
            if (element !== '.git') {
                copyFolderSync(path.join(from, element), path.join(to, element), shroud);
            }
        }
    });
}

/**
 * 递归删除文件夹
 * @param filePath 地址
 */
function deleteFolderRecursive(filePath) {
    let files = [];
    if (fs.existsSync(filePath)) {
        // 返回文件和子目录的数组
        files = fs.readdirSync(filePath);
        files.forEach((file) => {
            const curPath = path.join(filePath, file);
            // fs.statSync同步读取文件夹文件，如果是文件夹，在重复触发函数
            if (fs.statSync(curPath).isDirectory()) {
                // recurse
                deleteFolderRecursive(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        /**
         * 清除文件夹
         */
        fs.rmdirSync(filePath);

    }
}

/**
 * 修改文件内容
 * @param filePath 文件地址
 * @param content [[待替换文本,需要替换成的文本](,[待替换文本,需要替换成的文本])...]
 */
async function editFile(filePath, content) {
    filePath = path.join(filePath)
    let file = fs.readFileSync(filePath, "utf-8")
    content.forEach(e => {
        e[0] = e[0].replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        file = file.replace(new RegExp(e[0], "gm"), e[1])
    })
    fs.writeFileSync(filePath, file, (err) => {
        if (err) {
            console.error(err)
        }
    })
}

/**
 * 向指定文件的指定位置插入文本
 * @param filePath 文件路径
 * @param findStr 查找字符串
 * @param startLine 插入到查找到字符串所在行的偏移值 默认为1 为查找到字符串的下一行
 * @param content 要插入的正文
 */
function insertContent2File(filePath, findStr, startLine, content) {
    startLine = startLine || 1
    filePath = path.join("./temp/androidProject", filePath)
    let file = fs.readFileSync(filePath, 'utf-8')
    file = file.split("\n")
    let i = 0;
    let flag = false
    for (i in file) {
        if (file[i].indexOf(findStr) > -1) {
            flag = true
            break;
        }
    }
    if (!flag) {
        throw Error("插入文件内容失败")
    }
    file.splice((parseInt(i) + startLine), 0, content.filter(function (n) {
        return n
    }).join("\n"))

    fs.writeFileSync(filePath, file.join("\n"), (err) => {
        if (err) {
            console.error(err)
        }
    })

}

module.exports = {exists, copyFolderSync, deleteFolderRecursive, editFile, insertContent2File}
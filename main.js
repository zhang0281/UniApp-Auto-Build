const fs = require('fs')
const path = require('path');
const compressing = require("compressing");
const {exists, copyFolderSync, deleteFolderRecursive, editFile, insertContent2File} = require("./util.js")
const childProcess = require("child_process");

/**
 * 执行指定指令
 * @param cmd 指令
 */
async function exec(cmd) {
    try {
        console.log("[Command]", cmd)
        return await new Promise((resolve, reject) => {
            let spawn = childProcess.exec(cmd, {shell: true}, (error, stdout) => {
                console.log("====================================================================================================")
                if (error) {
                    if (stdout) {
                        resolve(stdout)
                    }
                    reject(error)
                } else {
                    resolve(stdout)
                }
            });

            spawn.stdout.on('data', (data) => {
                console.log('[stdout]', data.replace(/\\r\\n/g, ""))

                if (data.indexOf("Use arrow keys") > -1) {
                    spawn.stdin.write("\r\n")
                }
            })

            spawn.stderr.on('data', (data) => {
                console.log('[stderr]', data.replace(/\\r\\n/g, ""))

                if (data.indexOf('password') > -1) {
                    spawn.stdin.write(app.keyStore.storePassword + '\n')
                }
            })

            spawn.on('close', (code) => {
                if (code !== 0) {
                    console.log(`process exited with code ${code}`);
                }
                spawn.stdin.end();
            });
        })
    } catch (e) {

    }
}

let projectName = ""

let app = {}
let config = {}
let androidProjectFilePath = path.join("./lib/Android-SDK@3.2.16.81128_20211123.zip")

/**
 * 初始化要克隆的项目
 * @returns {Promise<void>}
 */
async function initProject() {
    let projectUrl = config["projectUrl"]
    // clone项目
    await exec(`git clone ${projectUrl} temp/${projectName} --progress`)
    // 如果项目已存在则更新
    await exec(`cd temp/${projectName} && git pull`)
    // 初始化项目
    await exec(`cd temp/${projectName} && yarn`)
}

/**
 * 初始化本地打包资源
 * @returns {Promise<void>}
 */
async function initUniCli() {
    // 新建cli项目
    await exec(`cd temp/ && vue create -p dcloudio/uni-preset-vue#alpha uniapp-cli`)
    // 初始化cli项目
    await exec(`cd temp/uniapp-cli && yarn`)
    // 文件操作 复制依赖项，复制源码
    copyFolderSync(`./temp/${projectName}/node_modules`, './node_modules')
    fs.copyFileSync(`./temp/${projectName}/manifest.json`, './temp/uniapp-cli/src/manifest.json')
    copyFolderSync(`./temp/${projectName}/`, "./temp/uniapp-cli/")
    copyFolderSync(`./temp/${projectName}/`, "./temp/uniapp-cli/src/", true)
    // 添加css相关依赖
    await exec(`cd temp/uniapp-cli && yarn add node-sass@4.14.1 sass-loader@8.0.2 less@3.9.0 less-loader@4.1.0`)
}

/**
 * 编译本地打包资源
 * @returns {Promise<void>}
 */
async function buildUniCli() {
    await exec(`cd temp/uniapp-cli && yarn build:app-plus`)
}

/**
 * 获取应用打包后文件信息
 * @returns {Promise<void>}
 */
async function getAppInfo() {
    let fileDir = path.join(`./temp/uniapp-cli/dist/build/app-plus`)
    let manifest = fs.readFileSync(path.join(fileDir, "manifest.json"))
    manifest = JSON.parse(manifest.toString())
    // uni-app id
    app.id = manifest.id
    // 应用名称
    app.name = manifest.name
    // 版本信息
    app.version = manifest.version
    app.permissions = []
    // 权限列表
    manifest["plus"]["distribute"]["google"]["permissions"].forEach(e => {
        if (e.indexOf("android.permission.MOUNT_UNMOUNT_FILESYSTEMS") === -1 &&
            e.indexOf("android.permission.READ_LOGS") === -1 &&
            e.indexOf("android.permission.WRITE_SETTINGS") === -1)
            app.permissions.push("    " + e.replace(/\\/g, ""))
    })
    // 模块
    app.plugins = manifest["plus"]["distribute"]["plugins"]
    // App key
    app.appKey = config["appKey"]
    // 包名
    app.packageName = config["packageName"]
}

/**
 * 解压AndroidSDK包并提取HBuilder-Integrate-AS项目至androidProject
 * @returns {Promise<void>}
 */
async function initAndroidProject() {
    deleteFolderRecursive("./temp/androidProject")
    await compressing.zip.uncompress(androidProjectFilePath, "temp/androidProjectTemp")
    let projectPath = path.join(
        "./temp/androidProjectTemp/", fs.readdirSync("./temp/androidProjectTemp/")[0],
        "/HBuilder-Integrate-AS"
    )
    copyFolderSync(projectPath, "./temp/androidProject")
    deleteFolderRecursive("./temp/androidProjectTemp")
}

/**
 * 配置安卓项目
 * @returns {Promise<void>}
 */
async function configureAndroidProject() {
    // 安卓项目路径
    let projectPath = path.join("./temp/androidProject")
    // 编辑settings.gradle
    let settingsGradlePath = path.join(projectPath, "/settings.gradle")
    let settingsGradleArr = [
        [`include ':simpleDemo'`, `include ':${app.packageName}'`],
    ]
    await editFile(settingsGradlePath, settingsGradleArr)
    // 编辑AndroidManifest.xml
    let androidManifestPath = path.join(projectPath, "/simpleDemo/src/main/AndroidManifest.xml")
    let androidManifestArr = [
        [`com.android.simple`, `${app.packageName}`],
        [`android:value="开发者需登录https://dev.dcloud.net.cn/申请签名" />`, `android:value="${app.appKey}" />`]
    ]
    await editFile(androidManifestPath, androidManifestArr)
    // 编辑AndroidManifest.xml 添加权限
    insertContent2File("/simpleDemo/src/main/AndroidManifest.xml", `package="${app.packageName}"`, 1, app.permissions)
    // 编辑build.gradle
    let buildGradlePath = path.join(projectPath, "/simpleDemo/build.gradle")
    let buildGradleArr = [
        [`applicationId "com.android.simple"`, `applicationId "${app.packageName}"`],
        [`versionCode 1`, `versionCode ${app.version.code}`],
        [`versionName "1.0"`, `versionName "${app.version.name}"`],
        [`keyAlias 'key0'`, `keyAlias '${app.keyStore.keyAlias}'`],
        [`keyPassword '123456'`, `keyPassword '${app.keyStore.storePassword}'`],
        [`storeFile file('test.jks')`, `storeFile file('${projectName}.jks')`],
        [`storePassword '123456'`, `storePassword '${app.keyStore.storePassword}'`],
    ]
    await editFile(buildGradlePath, buildGradleArr)
    // 编辑strings.xml
    let stringsXmlPath = path.join(projectPath, "/simpleDemo/src/main/res/values/strings.xml")
    let stringsXmlArr = [
        [`<string name="app_name">HBuilder-SimpleDemo-AS</string>`, `<string name="app_name">${app.name}</string>`]
    ]
    await editFile(stringsXmlPath, stringsXmlArr)
    // 编辑styles.xml
    let stylesXmlPath = path.join(projectPath, "/simpleDemo/src/main/res/values/styles.xml")
    let stylesXmlArr = [
        [`<item name="android:forceDarkAllowed">false</item>`, ``]
    ]
    await editFile(stylesXmlPath, stylesXmlArr)
    // 添加图标
    fs.copyFileSync(`./projects/${projectName}/icon.png`, projectPath + '/simpleDemo/src/main/res/drawable/icon.png')
    fs.copyFileSync(`./projects/${projectName}/icon.png`, projectPath + '/simpleDemo/src/main/res/drawable/push.png')
    fs.copyFileSync(`./projects/${projectName}/splash.png`, projectPath + '/simpleDemo/src/main/res/drawable/splash.png')
    // 添加资源文件
    deleteFolderRecursive(`${projectPath}/simpleDemo/src/main/assets/apps/__UNI__A`)
    copyFolderSync(`./temp/uniapp-cli/dist/build/app-plus/`, `${projectPath}/simpleDemo/src/main/assets/apps/${app.id}/www`)
    // 编辑dcloud_control.xml
    let dCloudControlXmlPath = path.join(projectPath, "simpleDemo/src/main/assets/data/dcloud_control.xml")
    let dCloudControlXmlArr = [
        [`<app appid="__UNI__A" appver=""/>`, `<app appid="${app.id}" appver=""/>`]
    ]
    await editFile(dCloudControlXmlPath, dCloudControlXmlArr)
    // 修改文件夹名称
    copyFolderSync(path.join(`./${projectPath}/simpleDemo`), path.join(`./${projectPath}/${app.packageName}`))
    deleteFolderRecursive(path.join(`./${projectPath}/simpleDemo`))
    // 生成密钥
    if (exists(`./projects/${projectName}/key.jks`)) {
        fs.unlinkSync(`./projects/${projectName}/key.jks`)
    }
    let keyStorePath = path.join(`./projects/${projectName}/`)
    await exec(`SET JAVA_TOOL_OPTIONS=-Duser.language=en && keytool -importkeystore -srckeystore ${path.join(keyStorePath + "key.keystore")} -srcstoretype JKS -deststoretype PKCS12 -destkeystore ${path.join(keyStorePath + "key.jks")}`)
    // 复制密钥
    fs.copyFileSync(keyStorePath + "key.jks", `${projectPath}/${app.packageName}/${projectName}.jks`)

    // 添加项目需要的库文件
    let libPath = path.join(projectPath, app.packageName, "libs")
    let allLibPath = path.join("./lib/android-libs/")
    let amapAdded = false;
    Object.keys(app.plugins).forEach(pluginName => {
        let plugin = app.plugins[pluginName]
        switch (pluginName) {
            case 'geolocation':
                if (plugin["amap"]) {
                    fs.copyFileSync(path.join(allLibPath, 'amap-libs-release.aar'), path.join(libPath, 'amap-libs-release.aar'))
                    fs.copyFileSync(path.join(allLibPath, 'geolocation-amap-release.aar'), path.join(libPath, 'geolocation-amap-release.aar'))
                    if (!amapAdded) {
                        insertContent2File(
                            app.packageName + "/src/main/AndroidManifest.xml",
                            `android:supportsRtl="true">`,
                            1,
                            [
                                `        <meta-data android:name="com.amap.api.v2.apikey" android:value="${plugin["amap"]["appkey_android"]}"></meta-data>`,
                                `        <service android:name="com.amap.api.location.APSService"></service>`]
                        )
                        // insertContent2File(app.packageName + "/src/main/assets/data/dcloud_properties.xml", "<features>", 1, [
                        //     `<feature name="Maps" value="io.dcloud.js.map.amap.JsMapPluginImpl"></feature>`]
                        // )
                    }
                    amapAdded = true;
                }
                break
            case 'push':
                if (plugin["unipush"]) {
                    fs.copyFileSync(path.join(allLibPath, 'aps-release.aar'), path.join(libPath, 'aps-release.aar'))
                    fs.copyFileSync(path.join(allLibPath, 'aps-unipush-release.aar'), path.join(libPath, 'aps-unipush-release.aar'))
                    // fs.copyFileSync(path.join(allLibPath, 'aps-igexin-release.aar'), path.join(libPath, 'aps-igexin-release.aar'))
                    fs.copyFileSync(path.join(allLibPath, 'gtc-3.1.2.0.aar'), path.join(libPath, 'gtc-3.1.2.0.aar'))
                    fs.copyFileSync(path.join(allLibPath, 'gtsdk-3.2.2.0.aar'), path.join(libPath, 'gtsdk-3.2.2.0.aar'))
                    fs.copyFileSync(path.join(allLibPath, 'hwp-3.0.1.aar'), path.join(libPath, 'hwp-3.0.1.aar'))
                    fs.copyFileSync(path.join(allLibPath, 'mzp-3.0.2.aar'), path.join(libPath, 'mzp-3.0.2.aar'))
                    fs.copyFileSync(path.join(allLibPath, 'oppo-3.0.3.aar'), path.join(libPath, 'oppo-3.0.3.aar'))
                    fs.copyFileSync(path.join(allLibPath, 'vivo-3.0.3.aar'), path.join(libPath, 'vivo-3.0.3.aar'))
                    fs.copyFileSync(path.join(allLibPath, 'xmp-3.0.2.aar'), path.join(libPath, 'xmp-3.0.2.aar'))

                    insertContent2File(
                        app.packageName + "/build.gradle",
                        `defaultConfig {`,
                        1,
                        [
                            `        manifestPlaceholders = [`,
                            [
                                `                "GETUI_APPID": "${config["unipush.appid"]}"`,
                                `                "plus.unipush.appid" : "${config["unipush.appid"]}"`,
                                `                "plus.unipush.appkey" : "${config["unipush.appkey"]}"`,
                                `                "plus.unipush.appsecret": "${config["unipush.appsecret"]}"`,
                                `                "apk.applicationId":"${app.packageName}"`,
                                config["MIPUSH_APPID"] ? `                "MIPUSH_APPID":"${config["MIPUSH_APPID"]}"` : null,
                                config["MIPUSH_APPKEY"] ? `                "MIPUSH_APPKEY":"${config["MIPUSH_APPKEY"]}"` : null,
                                config["MEIZUPUSH_APPID"] ? `                "MEIZUPUSH_APPID":"${config["MEIZUPUSH_APPID"]}"` : null,
                                config["com.huawei.hms.client.appid"] ? `                "com.huawei.hms.client.appid":"${config["com.huawei.hms.client.appid"]}"` : null,
                                config["OPPOPUSH_APPKEY"] ? `                "OPPOPUSH_APPKEY":"${config["OPPOPUSH_APPKEY"]}"` : null,
                                config["OPPOPUSH_APPSECRET"] ? `                "OPPOPUSH_APPSECRET":"${config["OPPOPUSH_APPSECRET"]}"` : null,
                                config["com.vivo.push.app_id"] ? `                "com.vivo.push.app_id":"${config["com.vivo.push.app_id"]}"` : null,
                                config["com.vivo.push.api_key"] ? `                "com.vivo.push.api_key":"${config["com.vivo.push.api_key"]}"` : null,
                            ].filter(function (n) {
                                return n
                            }).join(",\n"),
                            `        ]`,
                        ]
                    )
                    insertContent2File(
                        app.packageName + "/src/main/AndroidManifest.xml",
                        `android:supportsRtl="true">`,
                        1,
                        [
                            config["MIPUSH_APPID"] && config["MIPUSH_APPKEY"] ? `        <!--小米厂商配置——开始-->` : null,
                            config["MIPUSH_APPID"] && config["MIPUSH_APPKEY"] ? `        <meta-data android:name="MIPUSH_APPID" android:value="XM_${config["MIPUSH_APPID"]}" />` : null,
                            config["MIPUSH_APPID"] && config["MIPUSH_APPKEY"] ? `        <meta-data android:name="MIPUSH_APPKEY" android:value="XM_${config["MIPUSH_APPKEY"]}" />` : null,
                            config["MIPUSH_APPID"] && config["MIPUSH_APPKEY"] ? `        <!--小米厂商配置——结束-->` : null,
                            config["MEIZUPUSH_APPID"] && config["MEIZUPUSH_APPKEY"] ? `        <!--魅族厂商配置——开始-->` : null,
                            config["MEIZUPUSH_APPID"] && config["MEIZUPUSH_APPKEY"] ? `        <meta-data android:name="MEIZUPUSH_APPID" android:value="MZ_${config["MEIZUPUSH_APPID"]}" />` : null,
                            config["MEIZUPUSH_APPID"] && config["MEIZUPUSH_APPKEY"] ? `        <meta-data android:name="MEIZUPUSH_APPKEY" android:value="MZ_${config["MEIZUPUSH_APPKEY"]}" />` : null,
                            config["MEIZUPUSH_APPID"] && config["MEIZUPUSH_APPKEY"] ? `        <!--魅族厂商配置——结束-->` : null,
                            config["com.huawei.hms.client.appid"] ? `        <!--华为厂商配置——开始-->` : null,
                            config["com.huawei.hms.client.appid"] ? `        <meta-data android:name="com.huawei.hms.client.appid" android:value="${config["com.huawei.hms.client.appid"]}" />` : null,
                            config["com.huawei.hms.client.appid"] ? `        <!--华为厂商配置——结束-->` : null,
                            config["OPPOPUSH_APPKEY"] && config["OPPOPUSH_APPSECRET"] ? `        <!--OPPO厂商配置——开始-->` : null,
                            config["OPPOPUSH_APPKEY"] && config["OPPOPUSH_APPSECRET"] ? `        <meta-data android:name="OPPOPUSH_APPKEY" android:value="OP_${config["OPPOPUSH_APPKEY"]}" />` : null,
                            config["OPPOPUSH_APPKEY"] && config["OPPOPUSH_APPSECRET"] ? `        <meta-data android:name="OPPOPUSH_APPSECRET" android:value="OP_${config["OPPOPUSH_APPSECRET"]}" />` : null,
                            config["OPPOPUSH_APPKEY"] && config["OPPOPUSH_APPSECRET"] ? `        <!--OPPO厂商配置——结束-->` : null,
                            config["com.vivo.push.app_id"] && config["com.vivo.push.api_key"] ? `        <!--VIVO厂商配置——开始-->` : null,
                            config["com.vivo.push.app_id"] && config["com.vivo.push.api_key"] ? `        <meta-data android:name="com.vivo.push.app_id" android:value="${config["com.vivo.push.app_id"]}" />` : null,
                            config["com.vivo.push.app_id"] && config["com.vivo.push.api_key"] ? `        <meta-data android:name="com.vivo.push.api_key" android:value="${config["com.vivo.push.api_key"]}" />` : null,
                            config["com.vivo.push.app_id"] && config["com.vivo.push.api_key"] ? `        <!--VIVO厂商配置——结束-->` : null
                        ]
                    )

                    insertContent2File(
                        app.packageName + "/src/main/assets/data/dcloud_properties.xml",
                        "<features>",
                        1,
                        [
                            `        <feature name="Push" value="io.dcloud.feature.aps.APSFeatureImpl">`,
                            `            <module name="unipush" value="io.dcloud.feature.unipush.GTPushService"/>`,
                            `        </feature>`
                        ]
                    )
                    insertContent2File(
                        app.packageName + "/src/main/assets/data/dcloud_properties.xml",
                        "<services>",
                        1,
                        [
                            `        <service name="push" value="io.dcloud.feature.aps.APSFeatureImpl"/>`
                        ]
                    )
                    if (config["OPPOPUSH_APPKEY"] && config["OPPOPUSH_APPSECRET"]) {
                        insertContent2File(
                            app.packageName + "/src/main/AndroidManifest.xml",
                            `</intent-filter>`,
                            1,
                            [
                                `            <!-- oppo配置开始 -->`,
                                `            <intent-filter>`,
                                `                <action android:name="android.intent.action.oppopush" />`,
                                `                <category android:name="android.intent.category.DEFAULT" />`,
                                `            </intent-filter>`,
                                `            <!-- oppo配置结束 -->`
                            ]
                        )
                    }
                    if (config["com.huawei.hms.client.appid"]) {
                        insertContent2File(
                            "build.gradle",
                            `buildscript {`,
                            8,
                            [
                                `        // 配置HMS Core SDK的Maven仓地址。`,
                                `        maven {url 'https://developer.huawei.com/repo/'}`
                            ]
                        )
                        insertContent2File(
                            "build.gradle",
                            `allprojects {`,
                            8,
                            [
                                `        // 配置HMS Core SDK的Maven仓地址。`,
                                `        maven {url 'https://developer.huawei.com/repo/'}`
                            ]
                        )
                        insertContent2File(
                            "build.gradle",
                            `dependencies {`,
                            1,
                            [
                                `        // 增加agcp配置。`,
                                `        classpath 'com.huawei.agconnect:agcp:1.4.1.300'`
                            ]
                        )
                        insertContent2File(
                            app.packageName + "/build.gradle",
                            `apply plugin: 'com.android.application'`,
                            1,
                            [
                                `apply plugin: 'com.huawei.agconnect'`
                            ]
                        )
                        insertContent2File(
                            app.packageName + "/build.gradle",
                            `dependencies {`,
                            1,
                            [
                                `      implementation 'com.huawei.hms:push:5.0.2.300'`
                            ]
                        )
                        fs.copyFileSync(`./projects/${projectName}/agconnect-services.json`, path.join(projectPath, app.packageName, '/agconnect-services.json'))

                    }
                    // UniPush与个推同时配置会报错
                    // insertContent2File(app.packageName + "/src/main/AndroidManifest.xml", `package="uni.UNID8E408B">`, 1, [
                    //         `    <uses-permission android:name="getui.permission.GetuiService.${app.packageName}"/>`,
                    //         `    <permission android:name="getui.permission.GetuiService.${app.packageName}" android:protectionLevel="normal"/>`
                    //     ]
                    // )
                    // insertContent2File(app.packageName + "/src/main/AndroidManifest.xml", `xmlns:android="http://schemas.android.com/apk/res/android"`, 1, [
                    //         `xmlns:tools="http://schemas.android.com/tools"`
                    //     ]
                    // )
                    // insertContent2File(app.packageName + "/src/main/AndroidManifest.xml", `android:supportsRtl="true">`, 1, [
                    //         `        <meta-data android:name="PUSH_APPID" android:value="${unipush["unipush.appid"]}"/>`,
                    //         `        <meta-data android:name="PUSH_APPKEY" android:value="${unipush["unipush.appkey"]}"/>`,
                    //         `        <meta-data android:name="PUSH_APPSECRET" android:value="${unipush["unipush.appsecret"]}"/>`,
                    //         `        <service`,
                    //         `                android:name="com.igexin.sdk.PushService"`,
                    //         `                tools:replace="android:exported"`,
                    //         `                android:exported="true"`,
                    //         `                android:label="NotificationCenter"`,
                    //         `                android:process=":pushservice">`,
                    //         `            <intent-filter>`,
                    //         `                <action android:name="com.igexin.sdk.action.service.message"/>`,
                    //         `            </intent-filter>`,
                    //         `        </service>`,
                    //         `        <receiver android:name="com.igexin.sdk.PushReceiver">`,
                    //         `            <intent-filter>`,
                    //         `                <action android:name="android.intent.action.BOOT_COMPLETED"/>`,
                    //         `                <action android:name="android.net.conn.CONNECTIVITY_CHANGE"/>`,
                    //         `                <action android:name="android.intent.action.USER_PRESENT"/>`,
                    //         `                <action android:name="com.igexin.sdk.action.refreshls"/>`,
                    //         `                <action android:name="android.intent.action.MEDIA_MOUNTED"/>`,
                    //         `                <action android:name="android.intent.action.ACTION_POWER_CONNECTED"/>`,
                    //         `                <action android:name="android.intent.action.ACTION_POWER_DISCONNECTED"/>`,
                    //         `            </intent-filter>`,
                    //         `        </receiver>`,
                    //         `        <activity`,
                    //         `            android:name="com.igexin.sdk.PushActivity"`,
                    //         `            android:excludeFromRecents="true"`,
                    //         `            android:exported="false"`,
                    //         `            android:process=":pushservice"`,
                    //         `            android:taskAffinity="com.igexin.sdk.PushActivityTask"`,
                    //         `            android:theme="@android:style/Theme.Translucent.NoTitleBar"/>`,
                    //         `        <activity`,
                    //         `            android:name="com.igexin.sdk.GActivity"`,
                    //         `            android:excludeFromRecents="true"`,
                    //         `            android:exported="true"`,
                    //         `            android:process=":pushservice"`,
                    //         `            android:taskAffinity="com.igexin.sdk.PushActivityTask"`,
                    //         `            android:theme="@android:style/Theme.Translucent.NoTitleBar"/>`,
                    //         `        <receiver android:name="io.dcloud.feature.apsGt.GTNotificationReceiver"`,
                    //         `                    android:exported="false">`,
                    //         `            <intent-filter>`,
                    //         `                <action android:name="android.intent.action.BOOT_COMPLETED"/>`,
                    //         `                <action android:name="${app.packageName}.__CREATE_NOTIFICATION"/>`,
                    //         `                <action android:name="${app.packageName}.__REMOVE_NOTIFICATION"/>`,
                    //         `                <action android:name="${app.packageName}.__CLEAR_NOTIFICATION"/>`,
                    //         `                <action android:name="${app.packageName}.__CLILK_NOTIFICATION"/>`,
                    //         `            </intent-filter>`,
                    //         `        </receiver>`,
                    //         `        <service`,
                    //         `            android:name="io.dcloud.feature.apsGt.GTNormalIntentService"/>`
                    //     ]
                    // )
                    // insertContent2File(app.packageName + "/src/main/assets/data/dcloud_properties.xml", "<features>", 1, [
                    //         `        <feature name="Push" value="io.dcloud.feature.aps.APSFeatureImpl"><module name="igexin" value="io.dcloud.feature.apsGt.GTPushService"/></feature>`
                    //     ]
                    // )
                    // insertContent2File(app.packageName + "/src/main/assets/data/dcloud_properties.xml", "<services>", 1, [
                    //         `        <service name="push" value="io.dcloud.feature.aps.APSFeatureImpl" />`
                    //     ]
                    // )
                }
                break
            case 'maps':
                if (plugin["amap"]) {
                    fs.copyFileSync(path.join(allLibPath, 'amap-libs-release.aar'), path.join(libPath, 'amap-libs-release.aar'))
                    fs.copyFileSync(path.join(allLibPath, 'map-amap-release.aar'), path.join(libPath, 'map-amap-release.aar'))
                    if (!amapAdded) {
                        insertContent2File(
                            app.packageName + "/src/main/AndroidManifest.xml",
                            `android:supportsRtl="true">`,
                            1,
                            [
                                `        <meta-data android:name="com.amap.api.v2.apikey" android:value="${plugin["amap"]["appkey_android"]}"></meta-data>`,
                                `        <service android:name="com.amap.api.location.APSService"></service>`]
                        )
                        insertContent2File(
                            app.packageName + "/src/main/assets/data/dcloud_properties.xml",
                            "<features>",
                            1,
                            [
                                `<feature name="Maps" value="io.dcloud.js.map.amap.JsMapPluginImpl"></feature>`]
                        )
                    }
                    amapAdded = true;
                }
                break
            case 'payment':
                if (plugin["alipay"]) {
                    fs.copyFileSync(path.join(allLibPath, 'payment-alipay-release.aar'), path.join(libPath, 'payment-alipay-release.aar'))
                    fs.copyFileSync(path.join(allLibPath, 'alipayutdid.jar'), path.join(libPath, 'alipayutdid.jar'))
                    fs.copyFileSync(path.join(allLibPath, 'alipaysdk-noutdid-15.8.03.210428205839.aar'), path.join(libPath, 'alipaysdk-noutdid-15.8.03.210428205839.aar'))
                    insertContent2File(
                        app.packageName + "/src/main/assets/data/dcloud_properties.xml",
                        "<features>",
                        1,
                        [
                            `<feature name="Payment" value="io.dcloud.feature.payment.PaymentFeatureImpl"><module name="AliPay" value="io.dcloud.feature.payment.alipay.AliPay"/></feature>`]
                    )
                }
                if (plugin["weixin"]) {
                    fs.copyFileSync(path.join(allLibPath, 'payment-weixin-release.aar'), path.join(libPath, 'payment-weixin-release.aar'))
                    fs.copyFileSync(path.join(allLibPath, 'wechat-sdk-android-without-mta-6.7.9.aar'), path.join(libPath, 'wechat-sdk-android-without-mta-6.7.9.aar'))

                    insertContent2File(
                        app.packageName + "/src/main/assets/data/dcloud_properties.xml",
                        "<features>",
                        1,
                        [
                            `<feature name="Payment" value="io.dcloud.feature.payment.PaymentFeatureImpl"><module name="Payment-Weixin" value="io.dcloud.feature.payment.weixin.WeiXinPay"/></feature>`
                        ]
                    )
                    insertContent2File(
                        app.packageName + "/src/main/AndroidManifest.xml",
                        `package="${app.packageName}">`,
                        1,
                        [
                            `    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>`
                        ]
                    )
                    insertContent2File(
                        app.packageName + "/src/main/AndroidManifest.xml",
                        `android:supportsRtl="true">`,
                        1,
                        [
                            `        <meta-data android:name="WX_APPID"  android:value="${plugin["weixin"]["appid"]}" />`,
                            `        <activity`,
                            `                android:name="wx.WXPayEntryActivity"`,
                            `                android:exported="true"`,
                            `                android:theme="@android:style/Theme.Translucent.NoTitleBar"`,
                            `                android:launchMode="singleTop" />`
                        ]
                    )
                    let wxPayEntryActivityPath = path.join(projectPath, app.packageName, "src/main/java/wx/WXPayEntryActivity.java")
                    fs.mkdirSync(path.resolve(path.join(wxPayEntryActivityPath), '..'), {recursive: true})
                    fs.copyFileSync(path.join("./lib/src/wxapi/WXPayEntryActivity.java"), wxPayEntryActivityPath)
                    editFile(
                        wxPayEntryActivityPath,
                        [
                            [`package io.dcloud.HBuilder.wxapi;`, `package wx;`]
                        ]
                    )
                }
                break
            case 'speech':
                if (plugin["baidu"]) {
                    fs.copyFileSync(path.join(allLibPath, 'speech-release.aar'), path.join(libPath, 'speech-release.aar'))
                    fs.copyFileSync(path.join(allLibPath, 'speech_baidu-release.aar'), path.join(libPath, 'speech_baidu-release.aar'))

                    insertContent2File(
                        app.packageName + "/src/main/assets/data/dcloud_properties.xml",
                        "<features>",
                        1,
                        [
                            `    <feature name="Speech" value="io.dcloud.feature.speech.SpeechFeatureImpl">`,
                            `        <module name="baidu" value="io.dcloud.feature.speech.BaiduSpeechEngine"/>`,
                            `    </feature>`,
                        ]
                    )
                    insertContent2File(
                        app.packageName + "/src/main/AndroidManifest.xml",
                        `android:supportsRtl="true">`,
                        1,
                        [
                            `        <meta-data android:name="com.baidu.speech.APP_ID" android:value="${plugin["baidu"]["appid"]}"/>`,
                            `        <meta-data android:name="com.baidu.speech.API_KEY" android:value="${plugin["baidu"]["apikey"]}"/>`,
                            `        <meta-data android:name="com.baidu.speech.SECRET_KEY" android:value="${plugin["baidu"]["secretkey"]}"/>`,
                            `        <service android:name="com.baidu.speech.VoiceRecognitionService" android:exported="false" />`
                        ]
                    )
                }
                break
            case 'ad':
                break
            case 'audio':
                break
            case 'oauth':
                break
            case 'share':
                break
            default:
                console.error("识别Android模块错误!")
                throw Error("识别Android模块错误！")
        }
    })
}

/**
 * 打包为apk并复制到./projects/<项目名称>/
 * @returns {Promise<void>}
 */
async function buildAndroidProject() {
    await exec(`cd ./temp/androidProject && gradlew build`)
    fs.copyFileSync(
        `./temp/androidProject/${app.packageName}/build/outputs/apk/release/${app.packageName}-release.apk`,
        `./projects/${projectName}/${app.packageName}-${app.version.name}-${app.version.code}-release.apk`
    )
}

async function init() {
    // 获取项目名称
    projectName = process.argv[2]

    if (!exists(path.join(`./projects/${projectName}/`))) {
        throw Error("未找到对应项目的配置文件")
    }

    let configPath = path.join(`./projects/${projectName}/`, "config.json")
    config = fs.readFileSync(configPath, 'utf-8')
    config = JSON.parse(config)

    // 密钥相关信息
    app.keyStore = {
        keyAlias: config["keyStore.keyAlias"],
        storePassword: process.argv[3]
    }
}

async function main() {
    // 初始化项目
    await init()
    await initProject()
    // 初始化cli项目
    await initUniCli()
    // 编译APP本地资源
    await buildUniCli()
    // 识别名称。包名，版本号，权限
    await getAppInfo()
    // android 离线打包 SDK 初始化
    await initAndroidProject()
    // 替换 SDK，AppKey，包名，版本号，应用名称，资源图片，打包资源，AppId
    await configureAndroidProject()
    // android项目 编译
    await buildAndroidProject()
}

main()

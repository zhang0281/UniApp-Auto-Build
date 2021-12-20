# UNI-APP 自动离线打包为apk

## 使用说明

0. 需要下载 [SDK(Android-SDK@3.2.16.81128_20211123.zip)](https://nativesupport.dcloud.net.cn/AppDocs/download/android) 并且放到``` lib/ ``` 下。并解压其中的 ``` Android-SDK@3.2.16.81128_20211123/SDK/libs ``` 文件夹至``` lib/ ``` 下，并且重命名为``` android-libs ```
1. 将项目克隆到本地
2. 运行``` yarn ``` 初始化项目依赖
3. 在``` projects/ ```下 新建名为项目名称的文件夹。
如 ``` https://github.com/zhang0281/ID-card-verifier.git ```这个项目，.git前的``` ID-card-verifier ```即为项目名称。
4. 在新建的文件夹内放入应用图标并重命名为icon.png。
5. 放入启动背景图并重命名为splash.png。
6. 放入keystore文件并重命名为key.keystore。
7. 新建config.json 并进行配置。其中push相关的可以填入null
```json
{
  "projectUrl": "项目的HTTP协议的git地址",
  "appKey": "项目离线打包所需要的AppKey",
  "packageName": "APK包名",
  "keyStore.keyAlias": "项目keyStore别名",

  "unipush.appid": "UniPush的AppId，在开发者中心配置和获取",
  "unipush.appkey": "UniPush的AppKey，在开发者中心配置和获取",
  "unipush.appsecret": "UniPush的AppSecret，在开发者中心配置和获取",
  "MIPUSH_APPID": null,
  "MIPUSH_APPKEY": null,
  "MEIZUPUSH_APPID": null,
  "MEIZUPUSH_APPKEY": null,
  "com.huawei.hms.client.appid": null,
  "OPPOPUSH_APPKEY": null,
  "OPPOPUSH_APPSECRET": null,
  "com.vivo.push.app_id": null,
  "com.vivo.push.api_key": null
}
```
8. 运行main.js 。```  node main.js <项目名称> <keyStore密码> ```
9. 打包后的apk文件在``` projects/项目名称/ ```中，为``` <包名>-<版本Name>-<版本Code>-release.apk ```

## TODO

1. 对打包后的apk进行测试

## 可能遇到的问题

1. 目前只支持Windows系统运行。
2. 经测试jdk-1.8.0_311版本可用该工具。
3. 需要在环境变量中添加``` ANDROID_SDK_ROOT ``` 变量并安装android sdk。
4. 需要检查项目中添加的模块，如果没有在main.js->configureAndroidProject 中的switch中声明或者处理的话，则需要按照[文档](https://nativesupport.dcloud.net.cn/AppDocs/usemodule/androidModuleConfig/geolocation) 补充相应操作。
5. 如果遇到生成离线打包资源失败的情况可以尝试删除uniapp-auto-build内的node_modules后重新运行yarn初始化项目后再次运行。
6. 目前已配置模块：定位-高德地图，UniPush，地图-高德地图，支付，语音识别-百度

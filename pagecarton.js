import { AsyncStorage } from 'react-native';

const namespace = 'PAGECARTON';
global[namespace] = {};


/**
 *
 * @param expireInMinutes
 * @returns {Date}
 */
const getExpiryDate = function (expireInSeconds) {
    const now = new Date();
    let expireTime = new Date(now);
    expireTime.setSeconds(now.getSeconds() + expireInSeconds);
    return expireTime;
}

const setStorage = function (storage = AsyncStorage) {

    if (storage) {
        return global.localStorage = storage;
    }
    global.localStorage = new LocalStorage('./scratch');
    return global.localStorage;
}

const getStorage = function () {

    if (global.localStorage) {
        return global.localStorage;
    }
    setStorage();
    return global.localStorage;
}

const setStaticResource = function ({ name, value, expiry = 3600, storage = true }) {
    expiry = false !== expiry ? getExpiryDate(expiry) : false;
    let data = { value, expiry }
    storage ? getStorage().setItem(namespace + name, JSON.stringify(data)) : null;
    global[namespace][name] = data;
}

const setup = function ({ protocol = 'https://', domain = 'pagecarton.com', port = '', path = '', version = '0.0.1', storage }) {
    let homeUrl = '';
    if (storage) {
        setStorage(storage);
    }
    if (protocol) {
        homeUrl += protocol;
    }
    if (domain) {
        homeUrl += domain;
    }
    if (port) {
        homeUrl += port;
    }
    if (path) {
        homeUrl += path;
    }
    setStaticResource({
        name: "setup",
        value: {
            protocol,
            domain,
            port,
            path,
            version,
            homeUrl,
        },
    });
    //   console.log( homeUrl );
    return { homeUrl };
}

const urls = {
    favicon: "/favicon.ico",
    logo: "/img/logo.png",
    siteInfo: "/widgets/Application_SiteInfo?pc_widget_output_method=JSON",
    navigation: "/widgets/Ayoola_Menu?pc_widget_output_method=JSON",
    authentication: "/widgets/NativeApp_Authenticate?pc_widget_output_method=JSON",
    logout: "/widgets/NativeApp_Authenticate_Logout?pc_widget_output_method=JSON",
    posts: "/widgets/Application_Article_ShowAll?pc_widget_output_method=JSON"
};
const resetStaticResource = function (name) {
    global[namespace][name] = undefined;
    getStorage().removeItem(namespace + name)
}

const getStaticResource = function (name) {
    if (global[namespace][name]) {
        //    console.log( global[namespace][name] )
        let value = global[namespace][name].value;
        let expiry = global[namespace][name].expiry;
        if (expiry) {
            if (expiry && (new Date(expiry) < (new Date()))) {
                resetStaticResource(name);
                return false;
            }
        }
        return value;
    }

}

const getStaticServerResource = function (name) {
    if (getStaticResource(name)) {
        return getStaticResource(name);
    }
    else {
        getServerResource({ name });
    }

}
const resetStaticServerResource = function (name) {
    console.error("resetStaticServerResource is deprecated. Use resetStaticResource instead");
    resetStaticResource(name)
}

const getServerResource = function ({ name, url, method, contentType, refresh, postData, expiry }) {
    if (!url) {
        url = urls[name];
    }
    //  console.log(name);
    //  console.log(url);
    let link = '';
    if (!getStaticResource("setup") || !getStaticResource("setup").homeUrl) {
        console.error("PageCarton needs to be set up first before use. Use PAGECARTON.setup() to set up PageCarton in your App.js")
        return false;
    }
    link = getStaticResource("setup").homeUrl + url;

    return new Promise((resolve) => {
        if (!refresh) {
            if (getStaticResource(name)) {
                resolve(getStaticResource(name))
            }
            let data;
            if( getStorage().getItem(namespace + name).then )
            {
                getStorage().getItem(namespace + name).then( data => {
                    if (data !== null) {
                        data = JSON.parse(data);
                        if ({ value, expiry } = data) {
                            if (new Date(expiry) < (new Date())) {
                                resetStaticResource(name);
                            }
                            else {
                                setStaticResource({ name, value, expiry, storage: false });
                                value ? resolve(value) : null
                            }
                        }
                    }
                       
                }  )
            }
            else if (data = getStorage().getItem(namespace + name)) {
                if (data !== null) {
                    data = JSON.parse(data);
                    if ({ value, expiry } = data) {
                        if (new Date(expiry) < (new Date())) {
                            resetStaticResource(name);
                        }
                        else {
                            setStaticResource({ name, value, expiry, storage: false });
                            value ? resolve(value) : null
                        }
                    }
                }
            }
        }
    //    const fetch = fetch ? fetch : require("node-fetch");
        fetch(link, {
            method: method ? method : 'POST',
            headers: {
                Accept: contentType ? contentType : 'application/json',
                'Content-Type': contentType ? contentType : 'application/json',
            },
            body: postData ? JSON.stringify(postData) : {},
        }).then((response) => response.json()).then((value) => {
            setStaticResource({ name, value, expiry });
            value ? resolve(value) : value;
        }).catch((error) => {
            console.log(error);
        });


    })
}


export default {
    setup,
    getServerResource,
    getStaticServerResource,
    getStaticResource,
    resetStaticResource
}
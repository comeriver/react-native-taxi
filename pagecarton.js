import { AsyncStorage } from 'react-native';
import Config from './config';

const namespace = 'PAGECARTON-';
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

const setup = function ({ scheme = 'https', domain = 'pagecarton.com', port = '', path = '', version = '0.0.1', storage }) {
    let homeUrl = '';
    if (storage) {
        setStorage(storage);
    }
    if (scheme) {
        homeUrl += scheme.trim() + "://";
    }
    if (domain) {
        homeUrl += domain.trim();
    }
    if (port) {
        homeUrl += ":" + port.trim();
    }
    if (path) {
        homeUrl += path.trim();
    }
    setStaticResource({
        name: "setup",
        expiry: false,
        value: {
            scheme,
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
        let value = global[namespace][name].value;
        let expiry = global[namespace][name].expiry;
        if (expiry) {
            if (expiry && (new Date(expiry) < (new Date()))) {
                resetStaticResource(name);
                return false;
            }
        }
    //    console.log( value )
        return value;
    }
    else
    {
     //  console.log( name );
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

const getServerResource = function ({ name, url, method, contentType, refresh, postData, expiry, responseType = "JSON" }) {
    if (!url) {
        url = urls[name];
    }
    let link = '';
    if (!getStaticResource("setup") || !getStaticResource("setup").homeUrl) {
        if( ! Config.domain )
        {
            console.error("PageCarton needs to be set up first before use. Use PAGECARTON.setup() to set up PageCarton in your App.js")
            return false;
        }
        const pc = PageCarton.setup(
            {
                scheme: "http",
                domain: "localhost",
                port: "8888",
                path: "/taxi",
            }
        );
        link = pc.homeUrl + url;
    }
    else
    {
        link = getStaticResource("setup").homeUrl + url;
    }
//    console.log( link );
    return new Promise((resolve, reject ) => {
        if (!refresh) {
            if (getStaticResource(name)) {
                return resolve(getStaticResource(name))
            }
            else
            {
            //    console.log( name );
            }
            let data;
            if( getStorage().getItem(namespace + name).then )
            {
                getStorage().getItem(namespace + name).then( data => {
                    if (data !== null) {
                        //    console.log( data );
                        data = JSON.parse(data);
                        let value = data.value
                        let expiry = data.expiry
                        if ( expiry ) {
                            if (new Date(expiry) < (new Date())) {
                                resetStaticResource(name);
                                value = undefined;
                            }
                        }
                        if( value )
                        {
                            setStaticResource({ name, value, expiry, storage: false });
                            return resolve( value );
                        }

                    }
                       
                }  )
            }
            else if (data = getStorage().getItem(namespace + name)) {
                if (data !== null) {
                //    console.log( data );
                    data = JSON.parse(data);
                    if ({ value, expiry } = data) {
                        if (new Date(expiry) < (new Date())) {
                            resetStaticResource(name);
                        }
                        else {
                            setStaticResource({ name, value, expiry, storage: false });
                            if( value)
                            {
                                return resolve(value) 
                            }
                        }
                    }
                }
            }
        }
        if (!url) {
            const message = "No URL supplied for request " + name
            console.warn( message );
            return reject( message );
        }
        fetch(link, {
            method: method ? method : 'POST',
            headers: {
                Accept: contentType ? contentType : 'application/json',
                'Content-Type': contentType ? contentType : 'application/json',
                "AYOOLA-PLAY-MODE": responseType
            },
            body: postData ? JSON.stringify(postData) : '',
        }).then((response) => { 

        //    console.log( link );
        //    console.log( postData );
        //    console.log( response.status );
        //    response.text().then( text => console.log( text ) );

            if (response.status !== 200) {
                const message = 'Looks like there was a problem. Status Code: ' + response.status;
                console.error( message );
                //    response.text().then( text => console.log( text ) );
                return reject( message );
            }
            let data = {};    
            try
            {
                data = response.json()
            }
            catch( e )
            {
             //   response.text().then( text => console.log( text ) );
               console.warn( e )
               
            //    let message = "Invalid response received from server"
            //    alert( message ); 
            }
            return data;
        } ).then((value) => {
         //   console.log( value );
            setStaticResource({ name, value, expiry });
            if( value )
            { 
                return resolve(value)
            }
        }).catch((error) => {
            console.warn( error );
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
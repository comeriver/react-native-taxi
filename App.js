import React, { Component } from 'react';
import { Button, View, YellowBox } from 'react-native';
import { AppLoading } from 'expo';
import { Asset } from 'expo-asset';
import * as Font from 'expo-font';
import { createAppContainer, createStackNavigator } from 'react-navigation';
import HomeScreen from './screens/HomeScreen';
import Login from './screens/Login';
import PageCarton from './pagecarton.js'

console.ignoredYellowBox = ['Remote debugger'];
YellowBox.ignoreWarnings([
    'Unrecognized WebSocket connection option(s) `agent`, `perMessageDeflate`, `pfx`, `key`, `passphrase`, `cert`, `ca`, `ciphers`, `rejectUnauthorized`. Did you mean to put these under `headers`?'
]);

const RootStack = createStackNavigator(
    {
        Login: {
            screen: Login,
            navigationOptions: ({ navigation }) => ({
                header: null
            })
        },
        Home: {
            screen: HomeScreen,
            navigationOptions: ({ navigation }) => ({
                header: null
            })
        }
    },
    {
        initialRouteName: 'Login'
    }
);

const pc = PageCarton.setup(
    {
        scheme: "https",
        domain: "flexcab.com.ng",
        port: "",
        path: "",
    }
);



const AppContainer = createAppContainer(RootStack);

export default class App extends Component {
    _isMounted = false;
    constructor(props) {
        super(props);
        this.state = {
            isReady: false,
            token: '',
            email: '',
            site_info: {},
            phone_number: ''
        }
        this.handleChangeToken = this.handleChangeToken.bind(this);
    }

    componentWillUnmount() {
        this._isMounted = false;
    }
 
    componentDidMount()
    {
        this._isMounted = true;

        PageCarton.getServerResource({ 
            name: "authentication",
            expiry: false,
            local_request_only: true
        }).then((data) => {
            if (! data) {
                return false;
            }
            if (data.badnews) {
                return false;
            }
            this.handleChangeToken(data);
        })
    }
 
    async cacheResourcesAsync() {
        await Font.loadAsync({ Poppins: require('./assets/Poppins-Regular.ttf') });
        const images = [
            require('./assets/car.png'),
            require('./assets/person-marker.png'),
            require('./assets/taxi-icon.png'),
            require('./assets/passenger.png'),
            require('./assets/steeringwheel.png')
        ]

        const cacheImages = images.map((image) => {
            return Asset.fromModule(image).downloadAsync();
        });
        return Promise.all(cacheImages);
    }

    handleChangeToken(token) {
        let newState = { token }
        if( ! token )
        {
            //  we are logging out
            PageCarton.getServerResource( { url: "NativeApp_Authenticate_Logout", refresh: true } )
            .then( data => {
                //   console.log( data );
                PageCarton.resetStaticResource( "authentication" );

            } );          
        }
        if( token.auth_info?.email )
        {
            newState.email = token.auth_info?.email;
        }
        if( token.auth_info?.phone_number )
        {
            newState.phone_number = token.auth_info?.phone_number;
        }
        this._isMounted ? this.setState( newState ) : null;
    }

    render() {
        if (!this.state.isReady) {
            return (
                <AppLoading
                    startAsync={this.cacheResourcesAsync}
                    onFinish={() => {  this._isMounted ? this.setState({ isReady: true }) : null }}
                    onError={console.warn}
                />
            );
        }
        if (this.state.token === '') {
            return <Login pc={pc} email={this.state.email} phone_number={this.state.phone_number} handleChangeToken={this.handleChangeToken} />
        }
        return (
            <>
                <HomeScreen token={this.state.token} />
                <View style={{ borderWidth: 0.6, padding: 3, position: 'absolute', top: 50, left: 20, backgroundColor: "rgba( 255,255,255, 0.5 )" }}>
                    <Button
                        title="Log out"
                        color="#000"
                        onPress={() =>{
                            this.handleChangeToken( '' )
                        }}
                        accessibilityLabel="Go Back" 
                        />
                </View>

            </>
        )
    }
}




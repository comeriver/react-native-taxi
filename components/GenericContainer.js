import React, {Component} from 'react';
import * as Location from 'expo-location';
import { Platform, Alert } from 'react-native';
import * as Permissions from 'expo-permissions';


export default function genericContainer(WrappedComponent){
    return class extends Component{
        constructor(props){
            super(props);
            this.state = {
                locationResult: null,
                location: {coords: { latitude: -1.28333, longitude: 36.8219}}
            }
            this._getLocationAsync = this._getLocationAsync.bind(this);
        }

        componentDidMount() {
            this._getLocationAsync();  
        }

        _getLocationAsync = async () => {
            let { status, permissions } = await Permissions.askAsync(Permissions.LOCATION);
            if (status !== 'granted') {
              Alert.alert('We needs to use your location to show routes and get a ride. Please allow in Settings')
              this.setState({
                locationResult: 'Permission to access location was denied.',
                location,
              });
            }
            if (Platform.OS === 'ios'){
              if(permissions.location.ios.scope !== 'always'){
                Alert.alert('Please allow the app to always access your location in Settings');
              }
            }
         
            let location = await Location.getCurrentPositionAsync({});
            this.setState({ locationResult: JSON.stringify(location), location, });
        }

        render(){
            return <WrappedComponent location={this.state.location}/>;
        }
    }
}
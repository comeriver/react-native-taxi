import React, {Component } from 'react';
import * as Location from 'expo-location';
import { StyleSheet, View, Platform, Alert, Text, TouchableOpacity } from 'react-native';
import * as Permissions from 'expo-permissions';


export default function genericContainer(WrappedComponent){
    return class extends Component{
        _isMounted = false;

        constructor(props){
            super(props);
            this.state = {
                locationResult: null,
                location: {coords: { latitude: 7.7827, longitude: 4.5418}}
            }
            this._getLocationAsync = this._getLocationAsync.bind(this);
        }
    
        componentDidMount() {
            this._isMounted = true;
            this._getLocationAsync();  
        }

        componentWillUnmount() {
            this._isMounted = false;
        }

        _getLocationAsync = async () => {
            let { status, permissions } = await Permissions.askAsync(Permissions.LOCATION);
            if (status !== 'granted') {
              Alert.alert('We needs to use your location to show routes and get a ride. Please allow in Settings')
              this._isMounted ? this.setState({
                locationResult: 'Permission to access location was denied.',
                location,
              }) : null;
            }
            else if (Platform.OS === 'ios' && permissions.location.ios.scope !== 'always'){     
                Alert.alert('Please allow the app to always access your location in Settings');
            }
            else
            {
                let location = await Location.getCurrentPositionAsync({});
                location && this._isMounted ? this.setState({ locationResult: JSON.stringify(location), location, }) : location;
            }
         
        }

        render(){
            if( ! this.state.location )
            {
                return (
                <View>
                    <Text style={{ color: "red", marginHorizontal: 50, marginVertical: 200, fontSize: 20 }}>Please restart the app when you have enabled Location in your device Settings.</Text>
                    <TouchableOpacity onPress={null} style={styles.button}>
                        <Text style={styles.buttonText}>Exit</Text>
                    </TouchableOpacity>
                </View>
                );
            }
            return <WrappedComponent location={this.state.location}/>;
        }
    }
}
const styles = StyleSheet.create({
    button: {
        backgroundColor: 'rgb(25, 31, 76)',
        paddingVertical: 20,
        marginHorizontal: 50,
        marginVertical: 7
    },
    buttonText: {
        color: '#fff',
        textAlign: 'center',
        fontSize: 15
    },
})

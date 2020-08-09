import React, { Component } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Text } from 'react-native';
import Driver from './Driver'
import Passenger from './Passenger';
import genericContainer from '../components/GenericContainer';
import PageCarton from '../pagecarton.js'

const DriverWithGenericContainer = genericContainer(Driver);
const PassengerWithGenericContainer = genericContainer(Passenger);

export default class HomeScreen extends Component {
    _isMounted = false;
    constructor(props) {
        super(props);
        this.state = {
            isDriver: false,
            siteInfo: false,
            isPassenger: false
        };
        this.handleChange = this.handleChange.bind(this);
    }
    componentDidMount() {

        this._isMounted = true;

        //  retrive site info
        PageCarton.getServerResource( { url: "Application_SiteInfo" } )
        .then( siteInfo => {
            this._isMounted ? this.setState( { siteInfo } ) : null
        //   console.log( this.state )
        } ); 
    }

    componentWillUnmount() {
        this._isMounted = false;
    }

    handleChange(name, value) {
        this._isMounted ? this.setState({
            [name]: value
        }) : null;
    }

    render() {

        //  console.log( this.props.token?.auth_info );
        if ( ( this.state.siteInfo?.driver_user_group && this.props.token?.auth_info?.access_level  == this.state.siteInfo.driver_user_group ) || this.state.isDriver) {
            return <DriverWithGenericContainer token={this.props.token} />
        } else if ( this.state.siteInfo?.driver_user_group || this.state.isPassenger) {
            //    } else if (this.state.isPassenger) {
            return <PassengerWithGenericContainer token={this.props.token} />
        }

        return (
            <View style={styles.container}>
                <TouchableOpacity
                    style={[styles.choiceContainer, { borderBottomWidth: 1 }]}
                    onPress={() => this.handleChange('isDriver', true)}
                >
                    <Text style={styles.choiceText}>I'm a Rider</Text>
                    <Image source={require('../assets/steeringwheel.png')} style={styles.selectionImage} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.choiceContainer}
                    onPress={() => this.handleChange('isPassenger', true)}
                >
                    <Text style={styles.choiceText}>Get a ride now</Text>
                    <Image source={require('../assets/passenger.png')} style={styles.selectionImage} />
                </TouchableOpacity>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 50,
        backgroundColor: '#e8e8e8'
    },

    choiceContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },

    selectionImage: {
        height: 200,
        marginVertical: 20,
        width: 200
    },

    choiceText: {
        color: 'rgb(25, 31, 76)',
        marginVertical: 20,
        fontSize: 32
    }
});
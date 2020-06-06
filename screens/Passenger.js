import React, { Component } from 'react';
import { Linking, Button, View, StyleSheet, TextInput, Text, TouchableWithoutFeedback, Keyboard, ActivityIndicator, Image } from 'react-native';
import MapView from 'react-native-maps';
import PolyLine from '@mapbox/polyline';
import Constants from 'expo-constants'
import _ from 'lodash';
import BottomButton from '../components/BottomButton';
import PageCarton from '../pagecarton.js'

export default class Passenger extends Component {
    timer;
    constructor(props) {
        super(props);
        this.state = this.resetState(false);
        this.onChangeDestinationDebounced = _.debounce(this.onChangeDestination.bind(this), 250);
        this.getRouteDirections = this.getRouteDirections.bind(this);
        this.requestDriver = this.requestDriver.bind(this);
        this.resetState = this.resetState.bind(this);
        this.watchId = {}
    }

    componentWillUnmount() {
        this.resetState();
    }
  
    resetState(reset = true) {
        let newState = {
            destination: "",
            predictions: [],
            isReady: false,
            pointCoords: [],
            routeResponse: null,
            buttonAction: null,
            lookingForDriver: false,
            driverIsOnTheWay: false,
            booking_id: "",
            status: 0,
            driverLocation: null,
            buttonText: "REQUEST TAXI 🚗"
        };
        if (reset) {
            try {

                PageCarton.getServerResource({ name: "login-taxiapp" })
                    .then((userInfo) => {
                        return PageCarton.getServerResource({
                            name: "cancel-booking",
                            url: "/widgets/TaxiApp_Booking_Cancel",
                            refresh: true,
                            postData: {
                                passenger_id: userInfo.user_id,
                            }
                        })
                    }
                    ).catch(error => console.log(error))
                    .then((data) => {
                        if (data.goodnews) {
                            //    alert( data.goodnews );
                            this.setState(newState)
                        }

                    })

            } catch (error) {
                console.log(error);
                this.setState({ errorMessage: "There is an error logging in" });
            }

        }
        return newState;
    }

    async onChangeDestination(destination) {
        const apiUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?key=${Constants.manifest.android.config.googleMaps.apiKey}&input=${destination}&location=${this.props.location.coords.latitude},${this.props.location.coords.longitude}&radius=2000`;
        try {
            const response = await fetch(apiUrl);
            if (response.status !== 200) {
                console.error('Looks like there was a problem. Status Code: ' +
                    response.status);
                 //   console.log( response.url );
                    response.text().then( text => console.log( text ) );
                return false;
            }
            const json = await response.json();
            this.setState({
                predictions: json.predictions,
                buttonText: 'REQUEST TAXI 🚗'
            })
        } catch (err) {
            console.error(err);
        }
    }

    async getRouteDirections(destinationPlaceId, destinationName) {
        try {
            if( ! this.map )
            {
                return false;
            }
            const apiUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${this.props.location.coords.latitude},${this.props.location.coords.longitude}&destination=place_id:${destinationPlaceId}&key=${Constants.manifest.android.config.googleMaps.apiKey}`;

            const response = await fetch(apiUrl);
            if (response.status !== 200) {
                console.error('Looks like there was a problem. Status Code: ' +
                    response.status);
                    response.text().then( text => console.log( text ) );
                return false;
            }
            const json = await response.json();
            const points = PolyLine.decode(json.routes[0].overview_polyline.points);
            const pointCoords = points.map((point) => {
                return { latitude: point[0], longitude: point[1] }
            });
            this.setState({ pointCoords, predictions: [], destination: destinationName, routeResponse: json });
            Keyboard.dismiss();
            this.map.fitToCoordinates(pointCoords, { edgePadding: { top: 20, bottom: 20, left: 20, right: 20 } })

        } catch (error) {
            console.log(error)
        }
    }

    async requestDriver() {
        this.setState({ lookingForDriver: true });

        try {

            PageCarton.getServerResource({ name: "login-taxiapp" })
                .then((userInfo) => {
                    return PageCarton.getServerResource({
                        name: "make-booking",
                        url: "/widgets/TaxiApp_Booking_Creator",
                        refresh: true,
                        postData: {
                            destination: this.state.destination,
                            passenger_id: userInfo.user_id,
                            passenger_location: this.state.pointCoords[this.state.pointCoords.length - 1],
                            route_info: this.state.routeResponse,
                        }
                    })
                }
                ).catch(error => console.log(error))
                .then((data) => {
                    if (!data) {
                        alert("We could not get a booking from the server.");
                        return false;
                    }
                    if (data.badnews) {
                        return false;
                    }
                    if (data.goodnews) {


                        this.setState({
                            buttonText: 'BOOKING MADE. CONNECTING TO A RIDE',
                            booking_id: data.booking_id
                        });
                        this.refreshStatus();
                        return true;
                    }

                })

        } catch (error) {
            console.log(error);
            this.setState({ errorMessage: "There is an error logging in" });
        }
    }

    async refreshStatus() {
        if( this.state.booking_id )
        {
            this.timer = setTimeout(() => this.checkBookingStatus(), 10000)
        }
    }
    async checkBookingStatus() {

        try {
            PageCarton.getServerResource({
                name: "check-booking-status",
                url: "/widgets/TaxiApp_Booking_Status",
                refresh: true,
                postData: {
                    booking_id: this.state.booking_id,
                    passenger_location: this.state.pointCoords[this.state.pointCoords.length - 1]
                }
            }).catch(error => console.log(error))
                .then((data) => {
                    if (!data) {
                        this.setState({
                            buttonText: 'Connection error, still trying...',
                        });
                        this.refreshStatus();
                        return false;
                    }
                    if (this.state.status && data.badnews) {
                        alert(data.badnews);
                        return false;
                    }
                    if (data.goodnews) {
                        if (!data.status) {
                            this.setState({
                                buttonText: 'Looking for driver...',
                            });
                            this.refreshStatus();
                            return false;
                        }
                        else {
                            this.setState({
                                status: data.status,
                            });
                        }
                        if (!data.driver_location) {
                            data.driver_location = this.state.pointCoords[this.state.pointCoords.length - 1];
                        }
                        const pointCoords = [...this.state.pointCoords, data.driver_location];
                        switch (data.status) {
                            case -2:
                                this.setState({
                                    lookingForDriver: false,
                                    driverIsOnTheWay: false,
                                    buttonText: 'You canceled the trip'
                                });
                            break;
                            case -1:
                                this.setState({
                                    lookingForDriver: false,
                                    driverIsOnTheWay: true,
                                    buttonText: 'Driver canceled the trip'
                                });
                            break;
                            case 1:
                                this.setState({
                                    lookingForDriver: false,
                                    driverIsOnTheWay: true,
                                    driverLocation: data.driver_location,
                                    buttonText: 'DRIVER IS ON THE WAY'
                                });
                                this.refreshStatus();
                            break;
                            case 2:
                                this.setState({
                                    lookingForDriver: false,
                                    driverIsOnTheWay: true,
                                    driverLocation: data.driver_location,
                                    buttonText: 'Your ride has arrived'
                                });
                                this.refreshStatus();
                                break;
                            case 3:
                                this.setState({
                                    lookingForDriver: false,
                                    driverIsOnTheWay: false,
                                    driverLocation: data.driver_location,
                                    buttonText: 'You are enroute'
                                });
                                this.refreshStatus();
                                break;
                            case 4:
                                this.setState({
                                    lookingForDriver: false,
                                    driverIsOnTheWay: false,
                                    driverLocation: data.driver_location,
                                    buttonText: 'Trip Ended. View Summary!',
                                    buttonAction: () =>
                                    {
                                        Linking.openURL( PageCarton.getStaticResource( "setup" ).homeUrl + "/widgets/TaxiApp_Booking_Info/?booking_id=" + this.state.booking_id );
                                    }
                                });
                                //    this.refreshStatus();
                                break;
                        }
                        if( this.map )
                        {
                            this.map.fitToCoordinates(pointCoords, { edgePadding: { top: 30, bottom: 30, left: 30, right: 30 } });
                        }                    
                        return true;

                    }
                    else {
                        this.setState({
                            buttonText: 'Server content error, Still trying...',
                        });

                    }

                })

        } catch (error) {
            console.log(error);
            this.setState({ errorMessage: "There is an error logging in" });
        }
    }

    render() {

        //console.log( Constants.manifest.android.config.googleMaps.apiKey );
        let getDriver = null;
        let findingDriverActIndicator = null;
        let driverMarker = null;
        let marker = null;
        let cancelButton = null;
        let active = this.state.status ? true : false;

        if (this.state.driverIsOnTheWay) {
            active = true;
            driverMarker = (
                <MapView.Marker coordinate={this.state.driverLocation}>
                    <Image source={require('../assets/taxi-icon.png')} style={{ width: 40, height: 40 }} />
                </MapView.Marker>
            )
        }

        if (this.state.lookingForDriver) {
            active = true;
            findingDriverActIndicator = (
                <ActivityIndicator size='large' animating={this.state.lookingForDriver} />
            )
        }
        //  console.log( this.state.pointCoords );
        if (this.state.pointCoords.length > 0) {
            marker = (
                <MapView.Marker coordinate={this.state.pointCoords[this.state.pointCoords.length - 1]} />
            );
            getDriver = (
                <BottomButton onPressFunction={!this.state.lookingForDriver && !this.state.driverIsOnTheWay && !this.state.status ? this.requestDriver : () => { this.state.buttonAction ? this.state.buttonAction() : alert("Already connecting to a ride") }} buttonText={this.state.buttonText}>
                    {findingDriverActIndicator}
                </BottomButton>
            );
        }
        if (active) {
            cancelButton = (
                <View style={{ borderWidth: 1, position: 'absolute', top: 50, right: 20 }}>
                    <Button
                        title=" x  Cancel"
                        color="#000"
                        onPress={this.resetState}
                        style={{ backgroundColor: 'white', padding: 30 }}
                        accessibilityLabel="Back" />
                </View>
            )
        }

        return (
            <View style={styles.container}>
                <MapView
                    ref={map => { this.map = map }}
                    style={styles.map}
                    initialRegion={{
                        latitude: this.props.location.coords.latitude,
                        longitude: this.props.location.coords.longitude,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05
                    }}
                    onUserLocationChange={this._getLocationAsync}
                    showsUserLocation={true}
                >
                    <MapView.Polyline
                        coordinates={this.state.pointCoords}
                        strokeWidth={3}
                        strokeColor="red"
                    />
                    {
                        this.state.pointCoords.length > 0 ? (
                            <MapView.Marker coordinate={this.state.pointCoords[this.state.pointCoords.length - 1]} title={this.state.destination} />
                        ) : null
                    }
                    {driverMarker}
                </MapView>
                <TextInput placeholder="Enter destination..." value={this.state.destination} onChangeText={(destination) => {
                    this.setState({ destination })
                    this.onChangeDestinationDebounced(destination);
                }}
                    style={styles.destinationInput}
                />
                {this.state.predictions ?
                    this.state.predictions.map((prediction) => {
                        return (
                            <TouchableWithoutFeedback key={prediction.id} onPress={() => this.getRouteDirections(prediction.place_id, prediction.structured_formatting.main_text)}>
                                <View>
                                    <Text style={styles.suggestions}>{prediction.description}</Text>
                                </View>
                            </TouchableWithoutFeedback>
                        )
                    }) : null
                }
                {getDriver}
                {cancelButton}
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject
    },
    map: {
        ...StyleSheet.absoluteFillObject
    },

    destinationInput: {
        height: 70,
        borderWidth: 0.5,
        marginTop: 100,
        marginLeft: 20,
        marginRight: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        padding: 20,
        fontSize: 20
    },

    suggestions: {
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        padding: 10,
        fontSize: 18,
        borderWidth: 0.5,
        marginLeft: 20,
        marginRight: 20
    }
});


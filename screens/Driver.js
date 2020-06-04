import React, { Component } from 'react';
import { Button, View, StyleSheet, Text, ActivityIndicator, Image, Linking, Platform } from 'react-native';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import PolyLine from '@mapbox/polyline';
import Constants from 'expo-constants'
import BottomButton from '../components/BottomButton';
import PageCarton from '../pagecarton.js'

let locationsArray = [];
if (!TaskManager.isTaskDefined('locationUpdates'))
{
    TaskManager.defineTask('locationUpdates', ({ data: { locations }, error }) => {
        if (error) {
            console.log(error);
            return;
        }
        locationsArray = locations;
    })
}

export default class Driver extends Component {
    constructor(props) {
        super(props);
        this.state = this.resetState( false );
        this.getRouteDirections = this.getRouteDirections.bind(this);
        this.lookForPassenger = this.lookForPassenger.bind(this);
        this.acceptPassengerRequest = this.acceptPassengerRequest.bind(this);
        this.resetState = this.resetState.bind(this);
        this.updateStatus = this.updateStatus.bind(this);
        this.refreshPassengerSearch = this.refreshPassengerSearch.bind(this);
        this.socket = null;
    }

    componentWillUnmount() {
      this.state.status ? Location.stopLocationUpdatesAsync('locationUpdates') : null;
    }


    resetState(reset = true) {
        let state = {
            isReady: false,
            pointCoords: [],
            lookingForPassenger: false,
            passengerFound: false,
            booking_id: "",
            status: 0,
            driver_id: "",
            routeResponse: null
        };
        reset ? this.setState(state) : null;
        return state;
    }


    async getRouteDirections(destinationPlaceId) {
        try {
            // console.log(this.state.predictions);
            const apiUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${this.props.location.coords.latitude},${this.props.location.coords.longitude}&destination=place_id:${destinationPlaceId}&key=${Constants.manifest.android.config.googleMaps.apiKey}`;
            const response = await fetch(apiUrl);
            const json = await response.json();
            const points = PolyLine.decode(json.routes[0].overview_polyline.points);
            const pointCoords = points.map((point) => {
                return { latitude: point[0], longitude: point[1] }
            });
            this.setState({ pointCoords });
            this.map.fitToCoordinates(pointCoords, { edgePadding: { top: 20, bottom: 20, left: 20, right: 20 } })

        } catch (error) {
            console.log(error)
        }
    }

    async refreshPassengerSearch(){
        if( ! this.state.passengerFound  )
        {
            this.timer = setTimeout( () => this.lookForPassenger(), 10000 )
        }
    }
    
    async lookForPassenger() {
        if (!this.state.passengerFound) {
            this.setState({ lookingForPassenger: true });

            try {
                //   console.log(this.state.pointCoords);

                PageCarton.getServerResource({ name: "login" })
                    .then((userInfo) => {
                        this.setState(
                            {
                                driver_id: userInfo.user_id,
                                status: 0
                            }
                        );
    
                        return PageCarton.getServerResource({
                            name: "book-passenger",
                            url: "/widgets/TaxiApp_Booking_Driver",
                            refresh: true,
                            postData: {
                                driver_id: this.state.driver_id
                            }
                        })
                    }
                    ).catch(error => console.log(error))
                    .then((data) => {
                        if (!data) {

                            alert("We could not get a booking from the server.");
                            this.refreshPassengerSearch();
                            return false;
                        }
                        if (data.badnews) {
                            //   console.log(data);
                            alert(data.badnews);
                            this.refreshPassengerSearch();
                            return false;
                        }
                        if (data.goodnews) {

                            if (!data.route_info) {
                            //    alert("No route found for passenger");
                                this.refreshPassengerSearch();
                                return false;
                            }
                            this.setState({
                                lookingForPassenger: false,
                                passengerFound: true,
                                booking_id: data.booking_id,
                                routeResponse: data.route_info
                            });
                            this.refreshPassengerSearch();
                            this.getRouteDirections(data.route_info.geocoded_waypoints[0].place_id);
                            return true;
                        }

                    })

            } catch (error) {
                console.log(error);
                this.setState({ errorMessage: "There is an error logging in" });
            }

        }
    }

    updateStatus( status = undefined ) {
        try {
            if (!this.state.booking_id) {

                alert("No booking ID has been set");
                this.resetState();
                return false;
            }

            PageCarton.getServerResource({ name: "login" })
                .then((userInfo) => {

                    let newState = {};
                    if( ! this.state.driver_id )
                    {
                        newState.driver_id = userInfo.user_id;
                        this.setState( newState );
                    }
                    return PageCarton.getServerResource({
                        name: "set-status-passenger",
                        url: "/widgets/TaxiApp_Booking_Driver",
                        refresh: true,
                        postData: {
                            driver_id: this.state.driver_id,
                            booking_id: this.state.booking_id,
                            status: status ? status : this.state.status,
                            driver_location: { latitude: this.props.location.coords.latitude, longitude: this.props.location.coords.longitude },
                        }
                    })
                }
                ).catch(error => console.log(error))
                .then((data) => {
                    if (!data) {
                        alert("We could not get the booking status from the server.");
                        return false;
                    }
                    if (data.badnews) {
                        alert(data.badnews);
                        return false;
                    }
                //    alert( data.driver_id );
                //    alert( data.goodnews );
                    if (data.goodnews) {
                        if (!data.route_info) {
                        //    alert("No route found for passenger");
                            return false;
                        }
                        let newState = {};
                        if( status )
                        { 
                            newState.status = status;
                            this.setState( newState );
                        }
                        return true;
                    }

                })

        } catch (error) {
            console.log(error);
            this.setState({ errorMessage: "There is an error logging in" });
        }


    }

    acceptPassengerRequest() {

        try {
            //   console.log(this.state.pointCoords);
            if (!this.state.booking_id) {

                alert("No booking ID has been set");
                this.resetState();
                return false;
            }

            PageCarton.getServerResource({ name: "login" })
                .then((userInfo) => {
                    this.setState(
                        {
                            driver_id: userInfo.user_id,
                            status: 1
                        }
                    );
                    return PageCarton.getServerResource({
                        name: "set-status-passenger",
                        url: "/widgets/TaxiApp_Booking_Driver",
                        refresh: true,
                        postData: {
                            driver_id: this.state.driver_id,
                            booking_id: this.state.booking_id,
                            status: this.state.status,
                            driver_location: { latitude: this.props.location.coords.latitude, longitude: this.props.location.coords.longitude },
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
                        alert(data.badnews);
                        return false;
                    }
                    if (data.goodnews) {
                        if (!data.route_info) {
                        //    alert("No route found for passenger"); 
                            return false;
                        }
                        if (!TaskManager.isTaskDefined('locationUpdates'))
                        {
                            Location.startLocationUpdatesAsync('locationUpdates', { accuracy: 3, timeInterval: 5000 });
                        }
                        setInterval(() => {
                            if( locationsArray.length )
                            {
                                let latestLatitude = locationsArray[locationsArray.length - 1].coords.latitude;
                                let latestLongitude = locationsArray[locationsArray.length - 1].coords.longitude;
                                PageCarton.getServerResource({
                                    name: "refresh-status-passenger",
                                    url: "/widgets/TaxiApp_Booking_Driver",
                                    refresh: true,
                                    postData: {
                                        driver_id: this.state.driver_id,
                                        booking_id: this.state.booking_id,
                                        status: 1,
                                        driver_location: { latitude: latestLatitude, longitude: latestLongitude }
                                    }
                                })                                
                            }

                        }, 10000 );

                        if (Platform.OS === 'ios') {
                        //    Linking.openURL(`http://maps.apple.com/?daddr=${passengerLocation.latitude},${passengerLocation.longitude}`);
                        } else {
                        //    Linking.openURL(`geo:0,0?q=${passengerLocation.latitude},${passengerLocation.longitude}(Passenger)`);
                            // `https://www.google.com/maps/dir/api=1&destination=${passengerLocation.latitude},${passengerLocation.longitude}`
                        }

                        return true;
                    }

                })

        } catch (error) {
            console.log(error);
            this.setState({ errorMessage: "There is an error logging in" });
        }
    }

    render() {
        let endMarker = null;
        let startMarker = null;
        let cancelButton = null;
        let active = false;
        let findPassengerActIndicator = null;
        let passengerSearchText = "FIND PASSENGER 👥";
        let bottomButtomFunction = this.lookForPassenger;


        if (this.state.lookingForPassenger) {
            active = true;
            passengerSearchText = 'FINDING PASSENGER...';
            findPassengerActIndicator = (
                <ActivityIndicator size='large' animating={this.state.lookingForPassenger} />
            );
        }

        if (this.state.passengerFound) {
            active = true;

            passengerSearchText = 'FOUND PASSENGER! ACCEPT RIDE?';
            bottomButtomFunction = this.acceptPassengerRequest;
        }

        let updateStatus = this.updateStatus;
        let resetState = this.resetState;

        switch (this.state.status) 
        {
            case 1:
                active = true;
                passengerSearchText = 'At passenger location!';
                bottomButtomFunction = function()
                {
                    updateStatus( 2 );
                };
            break;
            case 2:
                active = true;
                passengerSearchText = 'Start Trip!';
                bottomButtomFunction = function()
                {
                    updateStatus( 3 );
                };
            break;
            case 3:
                active = true;
                passengerSearchText = 'End Trip';
                bottomButtomFunction = function()
                {
                    updateStatus( 4 );
                 //   resetState();
                };
            break;
            case 4:
                active = true;
                passengerSearchText = 'Trip Ended. View Summary!';
                bottomButtomFunction = function()
                {
                    alert( "Trip already ended!" );
                };
            break;
        }

        if (this.state.pointCoords.length > 1) {
            active = true;

            endMarker = (
                <MapView.Marker coordinate={this.state.pointCoords[this.state.pointCoords.length - 1]}>
                    <Image style={{ width: 40, height: 40 }} source={require('../assets/person-marker.png')} />
                </MapView.Marker>
            )
        }
        if (active) {
            cancelButton = (
                <View style={{ borderWidth: 1, position: 'absolute', top: 50, right: 20 }}>
                    <Button
                        title=" x  Cancel Trip"
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
                        latitudeDelta: 0.025,
                        longitudeDelta: 0.025
                    }}
                    onUserLocationChange={this._getLocationAsync}
                    showsUserLocation={true}
                >
                    <MapView.Polyline
                        coordinates={this.state.pointCoords}
                        strokeWidth={3}
                        strokeColor="red"
                    />
                    {endMarker}
                    {startMarker}
                </MapView>
                <BottomButton onPressFunction={bottomButtomFunction} buttonText={passengerSearchText}>
                    {findPassengerActIndicator}
                </BottomButton>
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
    }
});


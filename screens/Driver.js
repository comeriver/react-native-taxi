import React, { Component } from 'react';
import { Button, View, StyleSheet, Text, ActivityIndicator, Image, Linking, Vibration } from 'react-native';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import PolyLine from '@mapbox/polyline';
import BottomButton from '../components/BottomButton';
import PageCarton from '../pagecarton.js'
import Config from '../config';
import { resolveUri } from 'expo-asset/build/AssetSources';

let locationsArray = [];
if (!TaskManager.isTaskDefined('locationUpdates')) {
    TaskManager.defineTask('locationUpdates', ({ data: { locations }, error }) => {
        if (error) {
            console.warn(error);
            return;
        }
        locationsArray = locations;
    })
}

export default class Driver extends Component {

    _isMounted = false;
    _bookingBlacklist = [];
    siteInfo = PageCarton.getStaticResource( "Application_SiteInfo" );

    constructor(props) {
        super(props);
        this.state = this.resetState(false);
        this.getRouteDirections = this.getRouteDirections.bind(this);
        this.lookForPassenger = this.lookForPassenger.bind(this);
        this.acceptPassengerRequest = this.acceptPassengerRequest.bind(this);
        this.resetState = this.resetState.bind(this);
        this.updateStatus = this.updateStatus.bind(this);
        this.refreshPassengerSearch = this.refreshPassengerSearch.bind(this);
        this.switchStatusRefreshTimer = this.switchStatusRefreshTimer.bind(this);
        this.socket = null;
    }

    componentDidMount() {
        this._isMounted = true;
    }

    componentWillUnmount() {
        this._isMounted = false;
        if (TaskManager.isTaskDefined('locationUpdates')) {
            this.state.status ? Location.stopLocationUpdatesAsync('locationUpdates') : null;
        }

        //  this.resetState();
        this.refreshBackgroundLocation ? clearInterval(this.refreshBackgroundLocation) : null;
    }


    resetState() {
        let newState = {
            isReady: false,
            pointCoords: [],
            lookingForPassenger: false,
            passengerFound: false,
            booking_id: "",
            searchTryCount: 0,
            status: 0,
            driver_id: "",
            routeToPickUp: null,
            routeResponse: null
        };
        try {

            PageCarton.getServerResource({ name: "authentication", local_request_only: true })
                .then((userInfo) => {
                    return PageCarton.getServerResource({
                        name: "cancel-booking",
                        url: "/widgets/TaxiApp_Booking_Cancel",
                        refresh: true,
                        postData: {
                            driver_id: userInfo.auth_info.user_id,
                        }
                    })
                }
                ).catch(error => console.log(error))
                .then((data) => {
                    if (data && data.goodnews && this._isMounted) {
                        //  alert( data.goodnews );
                        this.setState(newState)
                    }

                })

        } catch (error) {
            console.warn(error);
        }
        return newState;
    }


    async getRouteDirections(destinationPlaceId) {
        try {
            if (!this.map) {
                return false;
            }

            // console.log(this.state.predictions);
            const routeToDestination = await PageCarton.getServerResource({
                name: "route",
                url: "/widgets/Places_Route?destination=place_id:" + destinationPlaceId + "&origin=" + this.props.location.coords.latitude + "," + this.props.location.coords.longitude,
                refresh: true
            });
            //   console.log(this.props.location.coords);
            if( ! routeToDestination )
            {
                return false;
            }
            if( routeToDestination.badnews )
            {
                alert( routeToDestination.badnews );
                return false;
            }
            if ( ! routeToDestination.routes[0]?.overview_polyline?.points ) {
                return false;
            }
            const points = PolyLine.decode(routeToDestination.routes[0].overview_polyline.points);
            const pointCoords = points.map((point) => {
                return { latitude: point[0], longitude: point[1] }
            });
            console.log(this.state.routeResponse?.geocoded_waypoints[0].place_id )
            console.log(destinationPlaceId)
            let newState = { pointCoords };
            if( ! this.state.routeResponse?.geocoded_waypoints[0].place_id || this.state.routeResponse?.geocoded_waypoints[0].place_id == destinationPlaceId )
            {
                newState.routeToPickUp = routeToDestination;
            }
            this._isMounted ? this.setState( newState ) : null;
            this.map.fitToCoordinates(pointCoords, { edgePadding: { top: 20, bottom: 20, left: 20, right: 20 } })
            return routeToDestination;
        } catch (error) {
            console.warn(error)
        }
    }

    async refreshPassengerSearch() {
        if (!this.state.passengerFound && this.state.lookingForPassenger) {
            this.timer1 = setTimeout(() => this.lookForPassenger(), 10000)
        }
    }

    async switchStatusRefreshTimer(init = false) {
        if (!this.state.booking_id) {
            this.resetState();
            return false;
        }
        if (init && this.statusRefreshTimer) {
            //  we are already set up
            return false;
        }
        if (this.state.booking_id && this.state.status) {
            this.statusRefreshTimer = setTimeout(() => this.refreshStatus(), 10000)
        }
    }

    async lookForPassenger() {
        if (!this.state.passengerFound) {

            try {
                //   console.log(this.state.pointCoords);

                PageCarton.getServerResource({ name: "authentication", local_request_only: true })
                    .then((userInfo) => {
                        this._isMounted ? this.setState(
                            {
                                driver_id: userInfo.auth_info.user_id,
                                status: 0
                            }
                        ) : null;
                     //   console.log( this._bookingBlacklist );
                        return PageCarton.getServerResource({
                            name: "find-passenger-x",
                            url: "/widgets/TaxiApp_Booking_Driver",
                            refresh: true,
                            postData: {
                                driver_id: this.state.driver_id,
                                booking_blacklist: this._bookingBlacklist,
                                driver_location: { latitude: this.props.location.coords.latitude, longitude: this.props.location.coords.longitude },
                            }
                        })
                    }
                    ).catch(error => console.log(error))
                    .then((data) => {
                        //    console.log(data);
                        let searchTryCount = ++this.state.searchTryCount;
                        this._isMounted ? this.setState({
                            searchTryCount
                        }) : null;
                        if (!data) {

                            alert("We could not get a booking from the server.");
                            this.resetState();
                            //    this.refreshPassengerSearch();
                            return false;
                        }
                        if (data.badnews) {
                            //   console.log(data);
                            alert(data.badnews);
                            //    this.refreshPassengerSearch();
                            this.resetState();
                            return false;
                        }
                        if (data.goodnews) {

                            if (!data.route_info || ! data.booking_id ) {
                                //    alert("No route found for passenger");
                                //    this.resetState();
                                this.refreshPassengerSearch();
                                return false;
                            }

                            this.getRouteDirections(data.route_info.geocoded_waypoints[0].place_id)
                            .then( routeInfo =>
                                {
                                    //    console.log( routeInfo );
                                    this._bookingBlacklist.push( data.booking_id );
                                //    console.log( this._bookingBlacklist );
                                    if( ! routeInfo )
                                    {
                                        return false;
                                    }        
                                    this._isMounted ? this.setState({
                                        lookingForPassenger: false,
                                        passengerFound: true,
                                        booking_id: data.booking_id,
                                        routeResponse: data.route_info
                                    }) : null;
                                    Vibration.vibrate([2000, 2000, 1000, 2000])
                                    this.refreshPassengerSearch();
                                    return true;
                                }
                            )
                        }

                    })

            } catch (error) {
                console.warn(error);
                this._isMounted ? this.setState({ errorMessage: "There is an error logging in" }) : null;
            }
        }
    }

    refreshStatus() {
        try {
            if (!this.state.booking_id) {
                this.resetState();
                return false;
            }
            //    console.log( this.state.booking_id );
            PageCarton.getServerResource({
                name: "set-status-passenger",
                url: "/widgets/TaxiApp_Booking_Driver",
                refresh: true,
                postData: {
                    driver_id: this.state.driver_id,
                    booking_id: this.state.booking_id,
                    driver_location: { latitude: this.props.location.coords.latitude, longitude: this.props.location.coords.longitude },
                }
            })
                .catch(error => console.log(error))
                .then((data) => {

                    if (!data) {
                        alert("We could not get the booking status from the server.");
                        return false;
                    }
                    //    console.log( this.state.booking_id );
                    //    console.log( data.status );
                    if (this.state.status && data.badnews) {
                        alert(data.badnews);
                        return false;
                    }
                    if (data.goodnews) {
                        if (!data.route_info) {
                            //    alert("No route found for passenger");
                            return false;
                        }
                        let newState = {};
                        if (data.status && data.status != this.state.status) {
                            Vibration.vibrate([1000, 2000, 1000, 2000])
                            newState.status = data.status;
                            this._isMounted ? this.setState(newState) : null;
                        }
                        if (data.status < 1 || data.status > 4) {
                            return false;
                        }
                        this.switchStatusRefreshTimer();
                        return true;
                    }

                })

        } catch (error) {
            console.warn(error);
            this._isMounted ? this.setState({ errorMessage: "There is an error logging in" }) : null;
        }


    }

    updateStatus(status = undefined) {
        try {
            if (!this.state.booking_id) {

                alert("No booking ID has been set");
                this.resetState();
                return false;
            }

            PageCarton.getServerResource({ name: "authentication", local_request_only: true })
                .then((userInfo) => {

                    let newState = {};
                    if (!this.state.driver_id) {
                        newState.driver_id = userInfo.auth_info.user_id;
                        this._isMounted ? this.setState(newState) : null;
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
                    //    console.log( status );
                    //    console.log( this.state.status );
                    //    console.log( this.state.booking_id );
                    if (this.state.status && data.badnews) {
                        alert(data.badnews);
                        return false;
                    }
                    if (data.goodnews) {
                        if (!data.route_info) {
                            //    alert("No route found for passenger");
                            return false;
                        }
                        let newState = {};
                        if (status) {
                            newState.status = status;
                            this._isMounted ? this.setState(newState) : null;
                        }
                        return true;
                    }

                })

        } catch (error) {
            console.warn(error);
            this._isMounted ? this.setState({ errorMessage: "There is an error logging in" }) : null;
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

            PageCarton.getServerResource({ name: "authentication", local_request_only: true })
                .then((userInfo) => {
                    this._isMounted ? this.setState(
                        {
                            driver_id: userInfo.auth_info.user_id,
                            status: 1
                        }
                    ) : null;
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
                        this.switchStatusRefreshTimer();
                        if (!TaskManager.isTaskDefined('locationUpdates')) {
                            Location.startLocationUpdatesAsync('locationUpdates', { accuracy: 3, timeInterval: 5000 });
                        }
                        this.refreshBackgroundLocation = setInterval(() => {
                            if (locationsArray.length) {
                                let latestLatitude = locationsArray[locationsArray.length - 1].coords.latitude;
                                let latestLongitude = locationsArray[locationsArray.length - 1].coords.longitude;
                                PageCarton.getServerResource({
                                    name: "refresh-status-passenger",
                                    url: "/widgets/TaxiApp_Booking_Driver",
                                    refresh: true,
                                    postData: {
                                        driver_id: this.state.driver_id,
                                        booking_id: this.state.booking_id,
                                        status: this.state.status,
                                        driver_location: { latitude: latestLatitude, longitude: latestLongitude }
                                    }
                                })
                            }

                        }, 10000);
                        /* 
                                                if (Platform.OS === 'ios') {
                                                    Linking.openURL(`http://maps.apple.com/?daddr=${passengerLocation.latitude},${passengerLocation.longitude}`);
                                                } else {
                                                    Linking.openURL(`geo:0,0?q=${passengerLocation.latitude},${passengerLocation.longitude}(Passenger)`);
                                                    // `https://www.google.com/maps/dir/api=1&destination=${passengerLocation.latitude},${passengerLocation.longitude}`
                                                }
                         */
                        return true;
                    }

                })

        } catch (error) {
            console.warn(error);
            this._isMounted ? this.setState({ errorMessage: "There is an error logging in" }) : null;
        }
    }

    render() {
        let endMarker = null;
        let startMarker = null;
        let cancelButton = null;
        let active = false;
        let findPassengerActIndicator = null;
        let passengerSearchText = "Look for " + ( (this.siteInfo?.passenger_term) ? this.siteInfo.passenger_term : 'requests' );
        let bottomButtomFunction = () => {
            this._isMounted ? this.setState({ lookingForPassenger: true }) : null;
            this.lookForPassenger();
        }


        if (this.state.lookingForPassenger) {
            active = true;
            passengerSearchText = 'Looking for ' + ( (this.siteInfo?.passenger_term) ? this.siteInfo.passenger_term : 'requests' ) + ' ... (' + this.state.searchTryCount + ')';
            findPassengerActIndicator = (
                <ActivityIndicator size='large' animating={this.state.lookingForPassenger} />
            );
        }

        if (this.state.passengerFound) {
            active = true;
            //    console.log( this.state.routeResponse );
            passengerSearchText = 'Accept pick-up request from ' + this.state.routeResponse?.routes[0]['legs'][0]['start_address'] + " (" +  (this.state.routeToPickUp?.routes[0]['legs'][0]['duration']['text']) + " away)";
            bottomButtomFunction = this.acceptPassengerRequest;
        }

        let updateStatus = this.updateStatus;
        let resetState = this.resetState;
        let viewBookingInfo = () => {
            if (this.state.booking_id) {
                Linking.openURL(PageCarton.getStaticResource("setup").homeUrl + "/object/TaxiApp_Booking_Info/?booking_id=" + this.state.booking_id);
            }
            else {
                alert("Booking has not been confirmed yet.");
            }
        };
        const checkDirectiontoDestination = () => {
            this.getRouteDirections( this.state.routeResponse?.geocoded_waypoints[1].place_id );
        };


        switch (this.state.status) {
            case -2:
                active = true;
                passengerSearchText = 'Trip canceled by ' + ( (this.siteInfo?.passenger_term) ? this.siteInfo.passenger_term : 'customer' ) + '. View Summary!';
                bottomButtomFunction = function () {
                    ;
                };
                break;
            case -1:
                active = true;
                passengerSearchText = 'Trip canceled by you. View Summary!';
                bottomButtomFunction = function () {
                    ;
                };
                break;
            case 1:
                active = true;
                passengerSearchText = 'At ' + ( (this.siteInfo?.passenger_term) ? this.siteInfo.passenger_term : 'customer' ) + ' location!';
                bottomButtomFunction = function () {
                    updateStatus(2);
                };
                break;
            case 2:
                active = true;
                passengerSearchText = 'Start ' + ( (this.siteInfo?.trip_term) ? this.siteInfo.trip_term : 'trip' ) + '!';

                bottomButtomFunction = function ( ) {
                    updateStatus(3);
                    checkDirectiontoDestination();
                };
                break;
            case 3:
                active = true;
                passengerSearchText = '' + ( (this.siteInfo?.trip_term) ? this.siteInfo.trip_term : 'trip' ) + ' Completed';
                bottomButtomFunction = function () {
                    updateStatus(4);
                    //   resetState();
                };
                break;
            case 4:
                active = true;
                passengerSearchText = '' + ( (this.siteInfo?.trip_term) ? this.siteInfo.trip_term : 'Request' ) + ' Completed. View Summary!';
                bottomButtomFunction = viewBookingInfo;
                break;
            case 5:
                active = true;
                passengerSearchText = 'Payment Received. View Summary!';
                bottomButtomFunction = viewBookingInfo;
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
                <>
                    <View style={{ borderWidth: 0.6, padding: 3, backgroundColor: "rgba( 255,255,255, 0.5 )", position: 'absolute', top: 50, right: 20 }}>
                        <Button
                            title="Cancel"
                            color="#000"
                            onPress={this.resetState}
                            style={{ backgroundColor: 'white', padding: 30 }}
                            accessibilityLabel="Back" />
                    </View>
                    <View style={{ borderWidth: 0.6, padding: 3, backgroundColor: "rgba( 255,255,255, 0.5 )", position: 'absolute', top: 50, right: 110 }}>
                        <Button
                            title="Info"
                            color="#000"
                            onPress={viewBookingInfo}
                            style={{ backgroundColor: 'white', padding: 30 }}
                            accessibilityLabel="Back" />
                    </View>
                </>
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
                    {this.state.pointCoords.length > 0 ? (<MapView.Polyline
                        coordinates={this.state.pointCoords}
                        strokeWidth={3}
                        strokeColor="red"
                    />) : null}
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


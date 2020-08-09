import React, { Component } from 'react';
import { Linking, Button, View, StyleSheet, TextInput, Text, TouchableWithoutFeedback, Keyboard, ActivityIndicator, Image, Vibration } from 'react-native';
import MapView from 'react-native-maps';
import PolyLine from '@mapbox/polyline';
import _, { random } from 'lodash';
import BottomButton from '../components/BottomButton';
import PageCarton from '../pagecarton.js'

export default class Passenger extends Component {
    timer;
    _isMounted = false;
    siteInfo = PageCarton.getStaticResource( "Application_SiteInfo" );

    constructor(props) {
        super(props);
        this.state = this.resetState(false);
        this.onChangeDestinationDebounced = _.debounce(this.onChangeDestination.bind(this), 250);
        this.getRouteDirections = this.getRouteDirections.bind(this);
        this.requestDriver = this.requestDriver.bind(this);
        this.resetState = this.resetState.bind(this);
        this.watchId = {}
    }
    componentDidMount() {
        this._isMounted = true;
    }

    componentWillUnmount() {
        this._isMounted = false;
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
            buttonText: "Request pickup"
        };
        if (reset) {
            try {

                PageCarton.getServerResource({ name: "authentication", local_request_only: true })
                    .then((userInfo) => {
                        return PageCarton.getServerResource({
                            name: "cancel-booking",
                            url: "/widgets/TaxiApp_Booking_Cancel",
                            refresh: true,
                            postData: {
                                passenger_id: userInfo.auth_info.user_id,
                            }
                        })
                    }
                    )
                    .then((data) => {
                        //    console.log( data );
                    })
                    .catch((error) => {
                        console.error("Could not confirm a booking cancelation on server" + error);
                    });
                this._isMounted ? this.setState(newState) : null
            } catch (error) {
                console.error(error);
            }

        }
        return newState;
    }

    async onChangeDestination(destination) {
        try {

            const response = await PageCarton.getServerResource({
                name: "places",
                url: "/widgets/Places?raw_response=1&q=" + destination + "&proximity=" + this.props.location.coords.latitude + "," + this.props.location.coords.longitude,
                refresh: true
            });
            if( ! response )
            {
                return false;
            }
            this._isMounted ? this.setState({
                predictions: response.predictions,
                buttonText: 'Request pick-up'
            }) : null;
        } catch (err) {
            console.error(err);
        }
    }

    async getRouteDirections(destinationPlaceId, destinationName) {
        try {
            if (!this.map) {
                return false;
            }
            const json = await PageCarton.getServerResource({
                name: "route",
                url: "/widgets/Places_Route?destination=place_id:" + destinationPlaceId + "&origin=" + this.props.location.coords.latitude + "," + this.props.location.coords.longitude,
                refresh: true
            });
            if( ! json )
            {
                return false;
            }
            if( json.badnews )
            {
                alert( json.badnews );
                return false;
            }
            if (!json?.routes[0]?.overview_polyline?.points) {
                return false;
            }
            const points = PolyLine.decode(json.routes[0].overview_polyline.points);
            const pointCoords = points.map((point) => {
                return { latitude: point[0], longitude: point[1] }
            });
            this._isMounted ? this.setState({ pointCoords, predictions: [], destination: destinationName, routeResponse: json }) : null;
            Keyboard.dismiss();
            this.map.fitToCoordinates(pointCoords, { edgePadding: { top: 20, bottom: 20, left: 20, right: 20 } })

        } catch (error) {
            console.warn(error)
        }
    }

    async requestDriver() {
        this.setState({ lookingForDriver: true });

        try {

            PageCarton.getServerResource({ name: "authentication", local_request_only: true })
                .then((userInfo) => {
                    return PageCarton.getServerResource({
                        name: "make-booking",
                        url: "/widgets/TaxiApp_Booking_Creator",
                        refresh: true,
                        postData: {
                            destination: this.state.destination,
                            passenger_id: userInfo.auth_info.user_id,
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
                        alert(data.badnews);
                        return false;
                    }
                    if (data.goodnews) {

                        Vibration.vibrate([2000, 1000, 2000])
                        this._isMounted ? this.setState({
                            buttonText: "" + ( (this.siteInfo?.trip_term) ? this.siteInfo.trip_term : '' ) + ' Pick-up Confirmed... Please wait',
                            booking_id: data.booking_id
                        }) : null;
                        this.refreshStatus();
                        return true;
                    }

                })

        } catch (error) {
            console.warn(error);
            this._isMounted ? this.setState({ errorMessage: "There is an error logging in" }) : null;
        }
    }

    async refreshStatus() {
        if (this.state.booking_id) {
            this.timer = setTimeout(() => this.checkBookingStatus(), 10000)
        }
    }
    async checkBookingStatus() {

        try {
            PageCarton.getServerResource({
                name: "check-booking-status",
                url: "/widgets/TaxiApp_Booking_Status?booking_id=" + this.state.booking_id,
                refresh: true,
                method: 'GET'
            }).catch(error => console.log(error))
                .then((data) => {
                    //    console.log( data );
                    //    console.log( this.state );
                    if (!data) {
                        this._isMounted ? this.setState({
                            buttonText: 'Connection error, still trying...',
                        }) : null;
                        this.refreshStatus();
                        return false;
                    }
                    if (this.state.status && data.badnews) {
                        alert(data.badnews);
                        return false;
                    }
                    if (data.goodnews) {
                        if (!data.status && this._isMounted) {
                            this.setState({
                                buttonText: "Connecting to " + ( (this.siteInfo?.driver_term) ? this.siteInfo.driver_term : 'operator' ),
                            });
                            this.refreshStatus();
                            return false;
                        }
                        else {

                            if (data.status !== this.state.status) {
                                Vibration.vibrate([2000, 2000, 1000, 2000])
                            }
                            this._isMounted ? this.setState({
                                status: data.status,
                            }) : null;
                        }
                        if (!data.driver_location) {
                            data.driver_location = this.state.pointCoords[this.state.pointCoords.length - 1];
                        }
                        const pointCoords = [...this.state.pointCoords, data.driver_location];
                        switch (data.status) {
                            case -2:
                                this._isMounted ? this.setState({
                                    lookingForDriver: false,
                                    driverIsOnTheWay: false,
                                    buttonText: 'You canceled the ' + ( (this.siteInfo?.trip_term) ? this.siteInfo.trip_term : 'operation' )
                                }) : null;
                                break;
                            case -1:
                                this._isMounted ? this.setState({
                                    lookingForDriver: false,
                                    driverIsOnTheWay: true,
                                    buttonText:  ( (this.siteInfo?.driver_term) ? this.siteInfo.driver_term : 'Operator' ) + ' canceled the ' + ( (this.siteInfo?.trip_term) ? this.siteInfo.trip_term : 'operation' )
                                }) : null;
                                break;
                            case 1:
                                this._isMounted ? this.setState({
                                    lookingForDriver: false,
                                    driverIsOnTheWay: true,
                                    driverLocation: data.driver_location,
                                    buttonText: ( (this.siteInfo?.driver_term) ? this.siteInfo.driver_term : 'Operator' ) + ' enroute to pick up '
                                }) : null;
                                this.refreshStatus();
                                break;
                            case 2:
                                this._isMounted ? this.setState({
                                    lookingForDriver: false,
                                    driverIsOnTheWay: true,
                                    driverLocation: data.driver_location,
                                    buttonText: ( (this.siteInfo?.driver_term) ? this.siteInfo.driver_term : 'Operator' ) + ' has arrived'
                                }) : null;
                                this.refreshStatus();
                                break;
                            case 3:
                                this._isMounted ? this.setState({
                                    lookingForDriver: false,
                                    driverIsOnTheWay: false,
                                    driverLocation: data.driver_location,
                                    buttonText: ( (this.siteInfo?.trip_term) ? this.siteInfo.trip_term : '' ) + ' in progress'
                                }) : null;
                                this.refreshStatus();
                                break;
                            case 4:
                                this._isMounted ? this.setState({
                                    lookingForDriver: false,
                                    driverIsOnTheWay: false,
                                    driverLocation: data.driver_location,
                                    buttonText: ( (this.siteInfo?.trip_term) ? this.siteInfo.trip_term : '' ) + ' Completed. Please Make Payment!',
                                    buttonAction: () => {
                                        Linking.openURL(PageCarton.getStaticResource("setup").homeUrl + "/object/TaxiApp_Booking_Pay/?booking_id=" + this.state.booking_id);
                                    }
                                }) : null;
                                this.refreshStatus();
                                break;
                            case 5:
                                this._isMounted ? this.setState({
                                    lookingForDriver: false,
                                    driverIsOnTheWay: false,
                                    driverLocation: data.driver_location,
                                    buttonText: 'Payment Confirmed. View Summary!',
                                    buttonAction: () => {
                                        Linking.openURL(PageCarton.getStaticResource("setup").homeUrl + "/object/TaxiApp_Booking_Info/?booking_id=" + this.state.booking_id);
                                    }
                                }) : null;
                                //    this.refreshStatus();
                                break;
                        }
                        if (this.map) {
                            this.map.fitToCoordinates(pointCoords, { edgePadding: { top: 30, bottom: 30, left: 30, right: 30 } });
                        }
                        return true;

                    }
                    else {
                        //    alert( "Server content error occured. Please try again later" );
                        this.resetState();

                    }

                })

        } catch (error) {
            console.warn(error);
            this._isMounted ? this.setState({ errorMessage: "There is an error logging in" }) : null;
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
        let viewBookingInfo = () => {
            if (this.state.booking_id) {
                Linking.openURL(PageCarton.getStaticResource("setup").homeUrl + "/widgets/TaxiApp_Booking_Info/?booking_id=" + this.state.booking_id);
            }
            else {
                alert("Booking has not been confirmed yet.");
            }
        };

        if (this.state.driverIsOnTheWay && this.state.driverLocation) {
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
                <BottomButton onPressFunction={!this.state.lookingForDriver && !this.state.driverIsOnTheWay && !this.state.status ? this.requestDriver : () => { this.state.buttonAction ? this.state.buttonAction() : alert("One  " + ( (this.siteInfo?.trip_term) ? this.siteInfo.trip_term : '' ) + " in progress" ) }} buttonText={this.state.buttonText}>
                    {findingDriverActIndicator}
                </BottomButton>
            );
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
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05
                    }}
                    onUserLocationChange={this._getLocationAsync}
                    showsUserLocation={true}
                >
                    {this.state.pointCoords.length > 0 ? (<MapView.Polyline
                        coordinates={this.state.pointCoords}
                        strokeWidth={3}
                        strokeColor="red"
                    />) : null}
                    {
                        this.state.pointCoords.length > 0 ? (
                            <MapView.Marker coordinate={this.state.pointCoords[this.state.pointCoords.length - 1]} title={this.state.destination} />
                        ) : null
                    }
                    {driverMarker}
                </MapView>
                <TextInput placeholder="Enter destination..." value={this.state.destination} onChangeText={(destination) => {
                    (this._isMounted ? this.setState({ destination }) : null)
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


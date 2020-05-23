import React, { Component } from 'react';
import { Button, View, StyleSheet, TextInput, Text, TouchableWithoutFeedback, Keyboard, ActivityIndicator, Image} from 'react-native';
import MapView from 'react-native-maps';
import PolyLine from '@mapbox/polyline';
import Constants from 'expo-constants'
import _ from 'lodash';
import socketIO from 'socket.io-client';
import BottomButton from '../components/BottomButton';
import { Updates } from 'expo';

export default class Passenger extends Component {
  constructor(props){
    super(props);
    this.state = {
      destination: "",
      predictions: [],
      isReady: false,
      pointCoords: [], 
      routeResponse: null,
      lookingForDriver: false,
      driverIsOnTheWay: false,
      driverLocation: null,
      buttonText: "REQUEST TAXI 🚗"
    };
    this.onChangeDestinationDebounced = _.debounce(this.onChangeDestination.bind(this), 250);
    this.getRouteDirections = this.getRouteDirections.bind(this);
    this.requestDriver = this.requestDriver.bind(this);
    this.watchId = {}
  }


  async onChangeDestination(destination){
    const apiUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?key=${Constants.manifest.android.config.googleMaps.apiKey}&input=${destination}&location=${this.props.location.coords.latitude},${this.props.location.coords.longitude}&radius=2000`;
    try{
      const result = await fetch(apiUrl);
      const json = await result.json();
      this.setState({
        predictions: json.predictions,
        buttonText: 'REQUEST TAXI 🚗'
      })
    } catch(err){
      console.error(err);
    }
  }

  async getRouteDirections(destinationPlaceId, destinationName){
    try{
      const apiUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${this.props.location.coords.latitude},${this.props.location.coords.longitude}&destination=place_id:${destinationPlaceId}&key=${Constants.manifest.android.config.googleMaps.apiKey}`;

      const response = await fetch(apiUrl);
      const json = await response.json();
      const points = PolyLine.decode(json.routes[0].overview_polyline.points);
      const pointCoords = points.map((point) => {
        return {latitude: point[0], longitude: point[1]}
      });
      this.setState({pointCoords, predictions: [], destination: destinationName, routeResponse: json });
      Keyboard.dismiss();
      this.map.fitToCoordinates(pointCoords, {edgePadding: {top: 20, bottom: 20, left: 20, right: 20}})

    } catch(error){
      console.log(error)
    }
  }

  async requestDriver(){
    this.setState({lookingForDriver: true});


    
    const socket = socketIO.connect('http://192.168.100.3:3000');
    socket.on('connect', () => {
      console.log('client connected');
      //Request a Taxi
      socket.emit('taxiRequest', this.state.routeResponse);
    });

    socket.on('driverLocation', (driverLocation) => {
      console.log('driver location updated');
      const pointCoords = [...this.state.pointCoords, driverLocation];
      this.map.fitToCoordinates(pointCoords, {edgePadding: {top: 30, bottom: 30, left: 30, right: 30}});
      this.setState({
        lookingForDriver: false, 
        driverIsOnTheWay: true, 
        driverLocation,
        buttonText: 'DRIVER IS ON THE WAY'
      });
    });
  }

  render() {

    //console.log( Constants.manifest.android.config.googleMaps.apiKey );
    let getDriver = null;
    let findingDriverActIndicator = null;
    let driverMarker = null;

    if(this.state.driverIsOnTheWay){
      driverMarker = (
        <MapView.Marker coordinate={this.state.driverLocation}>
          <Image source={require('../assets/taxi-icon.png')} style={{width: 40, height: 40}} />
        </MapView.Marker>
      )
    }

    if(this.state.lookingForDriver){
      findingDriverActIndicator = (
        <ActivityIndicator size='large' animating={this.state.lookingForDriver} />
      )
    }
  //  console.log( this.state.pointCoords );
    if (this.state.pointCoords.length > 1){
      marker = (
        <MapView.Marker coordinate={this.state.pointCoords[this.state.pointCoords.length - 1]}/>
      );
      getDriver = (
        <BottomButton onPressFunction={this.requestDriver} buttonText={this.state.buttonText}>
          {findingDriverActIndicator}
        </BottomButton>
      );
    }  
    return (
      <View style={styles.container}>
        <MapView
          ref={map => {this.map = map}}
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
            this.state.pointCoords.length > 1 ? (
              <MapView.Marker coordinate={this.state.pointCoords[this.state.pointCoords.length -1]} title={this.state.destination}/>
            ) : null
          }
          {driverMarker}
        </MapView>   
        <TextInput placeholder="Enter destination..." value={this.state.destination} onChangeText={(destination) => {
          this.setState({destination})
          this.onChangeDestinationDebounced(destination);
          }} 
          style={styles.destinationInput} 
        />
        {this.state.predictions ? 
          this.state.predictions.map((prediction) =>  {
            return(
              <TouchableWithoutFeedback key={prediction.id} onPress={() => this.getRouteDirections(prediction.place_id, prediction.structured_formatting.main_text)}>
                <View>
                  <Text style={styles.suggestions}>{prediction.description}</Text>
                </View>
              </TouchableWithoutFeedback>
            )
          }): null
        }
        {getDriver}
        <View style={{borderWidth:0,position:'absolute',top:50, left:20}}>
           <Button
             title="<   Exit"
             color="#000"
             onPress={Updates.reload}
             style={{ padding: 30, height: 60 }}
             accessibilityLabel="Go Back"/>
        </View>
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


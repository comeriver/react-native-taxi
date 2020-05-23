import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet, Platform} from 'react-native'


export default class BottomButton extends React.Component{
  render(){
    return(
      <TouchableOpacity style={styles.bottomButton} onPress={this.props.onPressFunction}>
            <View>
              <Text style={styles.bottomButtonText}>{this.props.buttonText}</Text>
              {this.props.children}
            </View>
      </TouchableOpacity>
    )
  }
}

const styles = StyleSheet.create({
  bottomButton: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    marginTop: "auto",
    margin: 20,
    marginBottom: 70,
    padding: 20,
    paddingLeft: 50,
    paddingRight: 50,
    borderRadius: 10,
    alignSelf: "center"
  },
  bottomButtonText: {
    fontSize: 20,
    color: "white",
    fontWeight: "600"
  }
})
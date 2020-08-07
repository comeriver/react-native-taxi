import React, { Component } from 'react'
import { Text, StyleSheet, View, TextInput, TouchableOpacity } from 'react-native'

export default class LoginForm extends Component {
  render() {
    return (
      <View>
        <Text style={styles.formLabel}>Email:</Text>
        <TextInput 
            style={styles.input} 
            placeholder='your@email.com'
            placeholderTextColor='#a9a9a9'
            keyboardType='email-address'
            autoCapitalize='none'
            autoCorrect={false}
            value={this.props.email}
            onChangeText={(email) => {this.props.handleChange('email', email)}}
        />
        <Text style={styles.formLabel}>Phone:</Text>
        <TextInput 
            style={styles.input} 
            placeholder='08055500555'
            placeholderTextColor='#a9a9a9'
            keyboardType='numeric'
            autoCapitalize='none'
            autoCorrect={false}
            value={this.props.phone_number}
            onChangeText={(phone_number) => {this.props.handleChange('phone_number', phone_number)}}
        />
        <Text style={{ margin: 20 }}> </Text>

        <TouchableOpacity onPress={this.props.handleSignIn} style={styles.button}>
            <Text style={styles.buttonText}>Request a Ride</Text>
        </TouchableOpacity>
      </View>
    )
  }
}

const styles = StyleSheet.create({
    input: {
        height: 70,
        borderWidth: 2,
        borderColor: '#4bc1bc',
        marginVertical: 10, 
        padding: 20,
        borderRadius: 4,
        fontSize: 18
    },
    button: {
        backgroundColor: 'rgb(25, 31, 76)',
        paddingVertical: 20,
        marginHorizontal: 5,
        marginVertical: 7
    },
    buttonText: {
        color: '#fff',
        textAlign: 'center',
        fontSize: 15
    },
    formLabel: {
      fontSize: 15,
      color: 'rgb(25, 31, 76)',
      marginVertical: 10, 

    }
})

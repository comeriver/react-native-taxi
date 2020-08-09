import React, { Component } from 'react'
import { Text, StyleSheet, View, TextInput, TouchableOpacity } from 'react-native'
import PageCarton from '../pagecarton.js'

export default class LoginForm extends Component {

    _isMounted = false;

    constructor(props) {
        super(props);
        this.state = {
            siteInfo: {}
        }
    }

    componentDidMount() {
        this._isMounted = true;
        //  retrive site info
        PageCarton.getServerResource({ url: "Application_SiteInfo" })
            .then(siteInfo => {
                this._isMounted ? this.setState({ siteInfo }) : null
                //   console.log( this.state )
            });
    }

    componentWillUnmount() {
        this._isMounted = false;
    }

    render() {
        let dColor = '#333'
if (this.state.siteInfo?.background_color) {
    dColor = this.state.siteInfo?.background_color;
}
//    console.log( dColor);
const styles = StyleSheet.create({
    input: {
        height: 70,
        borderWidth: 2,
        borderColor: '#333',
        marginVertical: 10,
        padding: 20,
        borderRadius: 4,
        fontSize: 18
    },
    button: {
        backgroundColor: dColor,
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
        color: '#000',
        marginVertical: 10,

    }
})

        return (
            <View>
                <Text style={styles.formLabel}>Email:</Text>
                <TextInput
                    style={styles.input}
                    placeholder='e.g. example@email.com'
                    placeholderTextColor='#a9a9a9'
                    keyboardType='email-address'
                    autoCapitalize='none'
                    autoCorrect={false}
                    value={this.props.email}
                    onChangeText={(email) => { this.props.handleChange('email', email) }}
                />
                <Text style={styles.formLabel}>Phone:</Text>
                <TextInput
                    style={styles.input}
                    placeholder='e.g. 08055500555'
                    placeholderTextColor='#a9a9a9'
                    keyboardType='numeric'
                    autoCapitalize='none'
                    autoCorrect={false}
                    value={this.props.phone_number}
                    onChangeText={(phone_number) => { this.props.handleChange('phone_number', phone_number) }}
                />
                <Text style={{ margin: 20 }}> </Text>

                <TouchableOpacity onPress={this.props.handleSignIn} style={styles.button}>
                    <Text style={styles.buttonText}>Request {(this.state.siteInfo?.trip_term) ? this.state.siteInfo.trip_term : 'Pick-up'}</Text>
                </TouchableOpacity>
            </View>
        )
    }
}

import React, { Component } from 'react';
import { Text, StyleSheet, View, Alert, Image } from 'react-native';
import LoginForm from '../components/LoginForm';
import axios from 'axios';
import baseUrl from '../baseUrl';
import PageCarton from '../pagecarton.js'

axios.defaults.baseURL = baseUrl;

export default class Login extends Component {
    constructor(props) {
        super(props);
        this.state = {
            email: props.email ? props.email : "example@gmail.com",
            password: '',
            phone_number: props.phone_number ? props.phone_number : "08055500555",
            errorMessage: ''
        }
        this.handleChange = this.handleChange.bind(this);
        this.handleSignIn = this.handleSignIn.bind(this);
        this.handleSignUp = this.handleSignUp.bind(this);
    }

    handleChange(name, value) {
        this.setState({
            [name]: value
        })
    }

    async handleSignUp() {

    }

    async handleSignIn() {
        this.setState({ errorMessage: '' });
        try {
            const { email, phone_number } = this.state;

            PageCarton.getServerResource({ 
                name: "login-taxiapp",
                url: "/widgets/TaxiApp_Login",
                refresh: true,
                expiry: false,
                postData: { email, phone_number } 
            }).then((data) => {
                if (! data) {
                    alert("We could not access the requested account information from the server.");
                    return false;
                }
                if (data.badnews) {
                    alert(data.badnews);
                    return false;
                }
                //    console.log( data );
                if (data.auth_info) {
                    this.props.handleChangeToken(data);
                    return true;
                }

            })

        } catch (error) {
           // console.warn(error);
            this.setState({ errorMessage: "There is an error logging in" });
        }
    }
    render() {
        return (
            <View style={styles.container}>
                <View  style={styles.item}>
                    <Image
                        source={{ uri: this.props.pc.homeUrl + "/img/logo.png" }}
                        style={styles.image}
                        resizeMode='contain'
                    />
                </View>
                <Text style={{ margin: 20 }}> </Text>
                <LoginForm
                    email={this.state.email}
                    password={this.state.password}
                    phone_number={this.state.phone_number}
                    handleChange={this.handleChange}
                    handleSignIn={this.handleSignIn}
                    handleSignUp={this.handleSignUp}
                />
                <Text style={styles.errorMessage}>{this.state.errorMessage}</Text>
                <Image source={require('../assets/car.png')} style={styles.logo} />
            </View>
        )
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#e8e8e8',
        paddingHorizontal: 30,
        paddingVertical: 40,
    },

  item: {
    alignItems: 'center',
    height:100,
    width:300,
    margin: 10
  },

  image: {
    flex: 1,
    height:200,
    width:200

  },
    errorMessage: {
        marginHorizontal: 5,
        fontSize: 18,
        color: 'red',
        fontWeight: 'bold',
    },

    headerText: {
        fontSize: 44,
        color: 'rgb(25, 31, 76)',
        marginTop: 30,
        marginBottom: 10,
        textAlign: 'center',
        fontWeight: "200",
    },
    logo: {
        width: 300,
        height: 300,
        alignSelf: 'center'
    }
})

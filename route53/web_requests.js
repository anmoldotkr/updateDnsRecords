const axios = require('axios');

exports.get = async function(url, headers) {
    try {
        if (!headers) {
            let response = await axios.get(url);
            let data = await response.data;
            return data;
        } else {
            let response = await axios.get(url, {
                headers: headers
            });
            let data = await response.data;
            console.log('Status:', await response.status);
            return data;
        }
    } catch (error) {
        console.log(error.response.data);
        console.log(error.message);
    }
}

exports.put = async function(url, headers, body) {
    try {
        if (!body) {
            let err = new Error('Missing Body');
            console.log(err);
            return;
        } else {
            if (!headers) {
                let err = new Error('Missing Headers');
                console.log(err);
                return;
            } else {
                let response = await axios.put(url, body, {
                    headers: headers
                });
                let data = await response.data;
                console.log('Status:', await response.status);
                return data;
            }
        }
    } catch (error) {
        console.log(error.response.data);
        console.log(error.message);
    }
}

exports.post = async function(url, headers, body) {
    try {
        if (!body) {
            let err = new Error('Missing Body');
            console.log(err);
            return;
        } else {
            if (!headers) {
                let err = new Error('Missing Headers');
                console.log(err);
                return;
            } else {
                let response = await axios.post(url, body, {
                    headers: headers
                });
                let data = await response.data;
                console.log('Status:', await response.status);
                return data;
            }
        }
    } catch (error) {
        console.log(error.response.data);
        console.log(error.message);
    }
}

exports.patch = async function(url, headers, body) {
    try {
        if (!body) {
            let err = new Error('Missing Body');
            console.log(err);
            return;
        } else {
            if (!headers) {
                let err = new Error('Missing Headers');
                console.log(err);
                return;
            } else {
                let response = await axios.patch(url, body, {
                    headers: headers
                });
                let data = await response.data;
                console.log('Status:', await response.status);
                return data;
            }
        }
    } catch (error) {
        console.log(error.response.data);
        console.log(error.message);
    }
}

exports.delete = async (url, headers) => {
    try {
        if (!headers) {
            let response = await axios.delete(url);
            let data = await response.data;
            return data;
        } else {
            let response = await axios.delete(url, {
                headers: headers
            });
            let data = await response.data;
            console.log('Status:', await response.status);
            return data;
        }
    }
    catch (error) {
        console.log(error);
    }
}

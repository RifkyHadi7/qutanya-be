const success = (res, data) => {
    return res.status(200).json({
        status: 'success',
        data,
    });
}

const error = (res, message, statusCode) => {
    return res.status(statusCode || 500).json({
        status: 'error',
        message,
    });
}

module.exports = {
    success,
    error
}
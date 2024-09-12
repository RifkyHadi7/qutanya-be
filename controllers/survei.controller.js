const model = require("../models/survei.model");
const { success, error } = require("../constraint/response");

const survei = {
  create: async (req, res) => {
    model.create(req.body).then((result) => {
      if (result.status == "ok") {
        success(res, result.data);
      } else {
        error(res, result.msg);
      }
    });
  },
  getResponses: async (req, res) => {
    model.getResponses(req.body).then((result) => {
      if (result.status == "ok") {
        success(res, result.data);
      } else {
        error(res, result.msg);
      }
    });
  },
  callbackPayment: async (req, res) => {
    model.callbackPayment(req.body).then((result) => {
      if (result.status == "ok") {
        success(res, result.data);
      } else {
        error(res, result.msg);
      }
    });
  },
};

module.exports = survei;

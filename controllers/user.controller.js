const model = require("../models/user.model");
const { success, error } = require("../constraint/response");

const user = {
  addUser: async (req, res) => {
    model.addUser(req.body, req.file).then((result) => {
      if (result.status == "ok") {
        success(res, result.msg);
      } else {
        error(res, result.msg);
      }
    })
  },
  login: async (req, res) => {
    model.login(req.body).then((result) => {
        if (result.status == "ok") {
            success(res, result.data);
          } else {
            error(res, result.msg);
          }
    })
  }
};

module.exports = user;

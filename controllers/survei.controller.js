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

  claimReward: async (req, res) => {
    model.claimReward(req.body).then((result) => {
      if (result.status == "ok") {
        success(res, result.data);
      } else {
        error(res, result.msg);
      }
    });
  },

  getDataAll: async (req, res) => {
    model.getDataAll(req.body).then((result) => {
      if (result.status == "ok") {
        success(res, result.data);
      } else {
        error(res, result.msg);
      }
    });
  },

  getDataById: async (req, res) => {
    model.getDataById(req.body).then((result) => {
      if (result.status == "ok") {
        success(res, result.data);
      } else {
        error(res, result.msg);
      }
    });
  },

  getRiwayatSurvei: async (req, res) => {
    model.getRiwayatSurvei(req.body).then((result) => {
      if (result.status == "ok") {
        success(res, result.data);
      } else {
        error(res, result.msg);
      }
    });
  },
  getRiwayatSurveiSaya: async (req, res) => {
    model.getRiwayatSurveiSaya(req.body).then((result) => {
      if (result.status == "ok") {
        success(res, result.data);
      } else {
        error(res, result.msg);
      }
    });
  },

  getDataHasil: async (req, res) => {
    model.getDataHasil(req.body).then((result) => {
      if (result.status == "ok") {
        success(res, result.data);
      } else {
        error(res, result.msg);
      }
    });
  },

  insertRiwayatSurvei: async (req, res) => {
    model.insertRiwayatSurvei(req.body).then((result) => {
      if (result.status == "ok") {
        success(res, result.data);
      } else {
        error(res, result.msg);
      }
    });
  },

  getDataList: async (req, res) => {
    model.getDataList(req.body).then((result) => {
      if (result.status == "ok") {
        success(res, result.data);
      } else {
        error(res, result.msg);
      }
    });
  },
};

module.exports = survei;

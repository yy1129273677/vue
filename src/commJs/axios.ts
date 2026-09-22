import axios from "axios";

// axios.defaults.baseURL = "/api";
axios.defaults.baseURL = "http://localhost:3001";

axios.defaults.headers.common = {
  "Content-Type": "application/json",
  Authorization: "Bearer " + localStorage.getItem("token") || "",
};

axios.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

axios.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    return Promise.reject(error);
  },
);

export default axios;

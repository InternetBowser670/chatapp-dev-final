var form = document.getElementById("form");

form.addEventListener("submit", (e) => {
  e.preventDefault();

  var formData = new FormData(form);

  fetch("/login", {
    method: "POST",
    body: formData,
    header: {
      "Content-Type": "multipart/form-data"
    }
  })
  .then((res) => {
    if (res.status == 200) {
      alert("You have logged in successfully")
      window.location.href = "./dashboard"
    } else if (res.status == 400) {
      alert("Login failed - accont does not exist")
    } else if (res.status == 403) {
      alert("Login failed - password is incorrect")
    }
  })

})
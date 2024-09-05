var form = document.getElementById("form");

form.addEventListener("submit", (e) => {
  e.preventDefault();

  var formData = new FormData(form);

  fetch("/updateUsername", {
    method: "POST",
    body: formData,
    header: {
      "Content-Type": "multipart/form-data"
    }
  })
  .then((res) => {
    window.location.href = "./dashboard"
  })

})
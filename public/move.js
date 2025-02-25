document.addEventListener("DOMContentLoaded", function () {
    const modal = document.querySelector(".modal-content");
    const modalContainer = document.getElementById("messageModal");

    let isDragging = false;
    let offsetX, offsetY;

    modal.addEventListener("mousedown", function (e) {
        isDragging = true;
        offsetX = e.clientX - modal.getBoundingClientRect().left;
        offsetY = e.clientY - modal.getBoundingClientRect().top;
        modal.style.cursor = "grabbing";
    });

    document.addEventListener("mousemove", function (e) {
        if (isDragging) {
            modal.style.left = `${e.clientX - offsetX}px`;
            modal.style.top = `${e.clientY - offsetY}px`;
            modal.style.position = "absolute";
        }
    });

    document.addEventListener("mouseup", function () {
        isDragging = false;
        modal.style.cursor = "grab";
    });

    // Open modal function
    window.openModal = function (id, message) {
        document.getElementById("modalMessage").innerText = message;
        modalContainer.style.display = "flex"; // Ensures it's visible with flex alignment
        modal.style.left = "50%";
        modal.style.top = "50%";
        modal.style.transform = "translate(-50%, -50%)";
    };

    // Close modal function
    window.closeModal = function () {
        modalContainer.style.display = "none";
    };
});

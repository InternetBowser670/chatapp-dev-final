document.querySelectorAll('.draggable-list').forEach(list => {
  let draggedItem = null;

  list.addEventListener('dragstart', (e) => {
    if (e.target.classList.contains('draggable-item')) {
      draggedItem = e.target;
      setTimeout(() => {
        e.target.style.display = 'none';  // Hide the dragged item for better feedback
      }, 0);
    }
  });

  list.addEventListener('dragend', (e) => {
    if (draggedItem) {
      setTimeout(() => {
        draggedItem.style.display = 'block';  // Show the item again after dragging ends
        draggedItem = null;  // Reset the dragged item
      }, 0);
    }
  });

  list.addEventListener('dragover', (e) => {
    e.preventDefault();  // Necessary to allow the drop
    const afterElement = getDragAfterElement(list, e.clientY);
    if (afterElement == null) {
      list.appendChild(draggedItem);
    } else {
      list.insertBefore(draggedItem, afterElement);
    }
  });

  function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.draggable-item:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }
});

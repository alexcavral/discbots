$(document).ready(async function () {
  $('#like').click(async () => {
    const swalWithBootstrapButtons = Swal.mixin({
      customClass: {
        confirmButton: 'btn btn-success',
        cancelButton: 'btn btn-danger'
      },
      buttonsStyling: true
    })
    let { isConfirmed } = await swalWithBootstrapButtons.fire({
      title: 'Tem certeza que quer votar neste bot?',
      text: "Você não poderá votar nas próximas 12 horas.",
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: 'Sim, Votar'
    })
    if (!isConfirmed) return;
    let botid = location.href.split(location.host)[1].replace('/bots/like/', '').replace('/', '');
    let req = await fetch(`/api/like/${botid}`, {
      method: "PATCH",
      headers: { 'Content-Type': 'application/json' }
    })
    req = await req.json()
    if (req.success) {
      await swalWithBootstrapButtons.fire({
        title: 'Sucesso',
        text: 'Você votou com sucesso!',
        icon: 'success'
      })
      location.href = `/bots/${botid}`
    } else {
      let hours = 11 - Math.floor(req.time / 3600000);
      let minutes = 60 - Math.ceil((req.time  / 60000) % 60);
      await swalWithBootstrapButtons.fire({
        title: 'Error',
        text: `Você pode votar novamente depois ${hours} horas e ${minutes} minutos`,
        icon: 'error'
      })
      location.href = `/bots/${botid}`
    }
  })
})

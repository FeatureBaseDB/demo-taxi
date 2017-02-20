class REPL {
    constructor(input, output) {
        this.input = input
        this.output = output
        this.history = []
        this.history_index = 0
        this.history_buffer = ''
        this.result_number = 0
    }
    bind_events() {
        const repl = this
        const keys = {
          ENTER: 13,
          UP_ARROW: 38,
          DOWN_ARROW: 40
        }

        this.input.addEventListener("keydown", (e) => {
          if (e.keyCode == keys.UP_ARROW) {
            e.preventDefault()
            if (this.input.value.substring(0, this.input.selectionStart).indexOf('\n') == '-1') {
                if (this.history_index == 0) {
                    return
                } else {
                    if (this.history_index == this.history.length) {
                        this.history_buffer = this.input.value
                    }
                    this.history_index--
                    this.input.value = this.history[this.history_index]
                    this.input.setSelectionRange(this.input.value.length, this.input.value.length)
                }
            }
          }
          if (e.keyCode == keys.DOWN_ARROW) {
            e.preventDefault()
            if (this.input.value.substring(this.input.selectionEnd, this.input.length).indexOf('\n') == '-1') {
                if (this.history_index == this.history.length) {
                    return
                } else {
                    this.history_index++
                    if (this.history_index == this.history.length) {
                        this.input.value = this.history_buffer
                    } else {
                        this.input.value = this.history[this.history_index]
                    }
                    this.input.setSelectionRange(this.input.value.length, this.input.value.length)
                }
            }
          }
          if (e.keyCode == keys.ENTER && !e.shiftKey) {
            e.preventDefault()
            this.history_buffer = ''
            this.history_index = this.history.length
            this.history[this.history_index] = this.input.value
            this.history_index++
            this.process_query(this.input.value)
            this.input.value = ""
          }
        })

        $('.modal').on('show.bs.modal', function(e) {
            var button = $(e.relatedTarget)
            var operation = button.data('operation')
            var modal = $(this)
            modal.find('.modal-title').text(operation)
            modal.find("input[name='operation']").val(operation)
            modal.find('input').first().focus()
        })

        $('.modal').on('shown.bs.modal', function(e) {
            $(this).find('input').filter(':visible').first().focus()
        })

        function process_modal(process_results) {
            return function(e) {
                e.preventDefault()
                var results = {}
                $.each($(this).serializeArray(), function() {
                    results[this.name] = this.value;
                })

                process_results(results)

                $(this).parents('.modal').modal('toggle')
                repl.input.select()
                repl.input.setSelectionRange(repl.input.value.length, repl.input.value.length)
            }
        }

        $('#setbit-modal').find('form').submit(process_modal(function(results) {
            repl.input.value = results['operation'] + '(id=' + results['bitmap-id'] + ', frame="' + results['frame'] + '", profileID=' + results['profile-id'] + ')'
        }))
        $('#setbitmapattrs-modal').find('form').submit(process_modal(function(results) {
            var attrs = 'key="value"'
            repl.input.value = results['operation'] + '(id=' + results['bitmap-id'] + ', frame="' + results['frame'] + '", ' + attrs + ')'
        }))
        $('#bitmap-modal').find('form').submit(process_modal(function(results) {
            repl.input.value = results['operation'] + '(id=' + results['bitmap-id'] + ', frame="' + results['frame'] + '")'
        }))
        $('#union-modal').find('form').submit(process_modal(function(results) {
            var bitmaps = results['bitmap']
            repl.input.value = results['operation'] + '(' + bitmaps + ')'
        }))
        $('#range-modal').find('form').submit(process_modal(function(results) {
            repl.input.value = results['operation'] + '(id=' + results['bitmap-id'] + ', frame="' + results['frame'] + '", start="' + results['start'] + '", end="' + results['end'] + '")'
        }))
        $('#topn-modal').find('form').submit(process_modal(function(results) {
            repl.input.value = results['operation'] + '(' + results['bitmap'] + ', frame="' + results['frame'] + '", n=' + results['n'] + ', ' + results['values'] + ')'
        }))
    }

    process_query(query) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'http://localhost:15000/query?db=1');
        xhr.setRequestHeader('Content-Type', 'application/text');

        const repl = this
        xhr.onload = function() {
            repl.result_number++
//const entry = document.createElement('p')
            const result = (
              '<div class="container result">' +
                '<ul class="nav nav-tabs" role="tablist">' +
                  '<li class="nav-item">' +
                    '<a class="nav-link active" data-toggle="tab" href="#result' + repl.result_number + '" role="tab">Result</a>' +
                  '</li>' +
                  '<li class="nav-item">' +
                    '<a class="nav-link" data-toggle="tab" href="#raw' + repl.result_number + '" role="tab">Raw</a>' +
                  '</li>' +
                '</ul>' +
'' +
                '<div class="tab-content">' +
                  '<div class="tab-pane active" id="result' + repl.result_number + '" role="tabpanel">' +
                    '<p class="query">' +
                        query +
                    '</p>' +
                    '<p>Response</p>' +
                    '<p class="response">' +
                      xhr.responseText +
                    '</p>' +
                  '</div>' +
                  '<div class="tab-pane" id="raw' + repl.result_number + '" role="tabpanel">' +
                    '<table class="table table-inverse"><tbody>' +
                    '<tr><th>Response code</th><td>' + xhr.status + '</td></tr>' +
                    '<tr><th>Response text</th><td>' + xhr.responseText + '</td></tr>' +
                    '<tr><th>Response URL</th><td>' + xhr.responseURL + '</td></tr>' +
                    '</tbody></table>' +
                  '</div>' +
                '</div>' +
              '</div>')
            $(repl.output).prepend($(result))
        };
        xhr.send(query);
    }
}

function startup() {
    const input = document.querySelector('.input-textarea')
    const output = document.querySelector('.output')
    repl = new REPL(input, output)
    repl.bind_events()
}

!function(s){"use strict";s("#sidebarToggle, #sidebarToggleTop").on("click",function(e){s("body").toggleClass("sidebar-toggled"),s(".sidebar").toggleClass("toggled"),s(".sidebar").hasClass("toggled")&&s(".sidebar .collapse").collapse("hide")}),s(window).resize(function(){s(window).width()<768&&s(".sidebar .collapse").collapse("hide"),s(window).width()<480&&!s(".sidebar").hasClass("toggled")&&(s("body").addClass("sidebar-toggled"),s(".sidebar").addClass("toggled"),s(".sidebar .collapse").collapse("hide"))}),s("body.fixed-nav .sidebar").on("mousewheel DOMMouseScroll wheel",function(e){if(768<s(window).width()){var o=e.originalEvent,l=o.wheelDelta||-o.detail;this.scrollTop+=30*(l<0?1:-1),e.preventDefault()}}),s(document).on("scroll",function(){100<s(this).scrollTop()?s(".scroll-to-top").fadeIn():s(".scroll-to-top").fadeOut()}),s(document).on("click","a.scroll-to-top",function(e){var o=s(this);s("html, body").stop().animate({scrollTop:s(o.attr("href")).offset().top},1e3,"easeInOutExpo"),e.preventDefault()})}(jQuery);

function initToolbarBootstrapBindings() {
    var fonts = ["Serif", "Sans", "Arial", "Arial Black", "Courier", "Courier New", "Comic Sans MS", "Helvetica", "Impact", "Lucida Grande", "Lucida Sans", "Tahoma", "Times", "Times New Roman", "Verdana"],
        fontTarget = $("[title=Font]").siblings(".dropdown-menu");
    $.each(fonts, function (idx, fontName) {
        fontTarget.append($('<li><a data-edit="fontName ' + fontName + '" style="font-family:\'' + fontName + "'\">" + fontName + "</a></li>"));
    });
    $("a[title]").tooltip({ container: "body" });
    $(".dropdown-menu input")
        .click(function () {
            return false;
        })
        .change(function () {
            $(this).parent(".dropdown-menu").siblings(".dropdown-toggle").dropdown("toggle");
        })
        .keydown("esc", function () {
            this.value = "";
            $(this).change();
        });

    $("[data-role=magic-overlay]").each(function () {
        var overlay = $(this),
            target = $(overlay.data("target"));
        overlay.css("opacity", 0).css("position", "absolute").offset(target.offset()).width(target.outerWidth()).height(target.outerHeight());
    });
}
function showErrorAlert(reason, detail) {
    var msg = "";
    if (reason === "unsupported-file-type") {
        msg = "Unsupported format " + detail;
    } else {
        console.log("error uploading file", reason, detail);
    }
    $('<div class="alert"> <button type="button" class="close" data-dismiss="alert">&times;</button>' + "<strong>File upload error</strong> " + msg + " </div>").prependTo("#alerts");
}

function text_editor($id) {
  initToolbarBootstrapBindings();
  $($id).wysiwyg({ fileUploadError: showErrorAlert });
  window.prettyPrint && prettyPrint();
  $($id).keyup(function () {
      var currentText = $(this).html();
      $($id).parent().find(".live").val(currentText);
  });
}

var usersTable = $('#usersTable').DataTable();
var earthquakesTable = $('#earthquakesTable').DataTable( {
  "order": [[ 0, "desc" ]]
});

$(".datepicker").datepicker({
  dateFormat: "dd.mm.yy",
  monthNames: ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"],
  dayNamesMin: ["Pa", "Pt", "Sl", "Ara", "Pe", "Cu", "Ct"],
  firstDay: 1,
});
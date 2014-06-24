# Deferred Dynamic PJAX

Fork of DJAX with deferred DOM replacement.

## Getting Started
Download the [production version][min] or the [development version][max].

[min]: https://raw.github.com/savio/ddjax/master/dist/jquery.ddjax.min.js
[max]: https://raw.github.com/savio/ddjax/master/dist/jquery.ddjax.js

In your web page:

```html
<script src="/libs/jquery/jquery-1.11.1.min.js"></script>
<script src="jquery.ddjax.min.js"></script>

<script type="text/javascript">
    //
    // Initialize DDJAX
    //
    $("#djaxableBox1").ddjax({
        'selector' : '.ddjax-this-block'
    });

    //
    // Implement DOM manipulation specs
    //
    $(window).bind('djaxDeferReplacements', function (e, specs_array) {

        for (var i=0;i<specs_array.length;i++) {

            var spec = specs_array[i];
            var spec_type = spec.type;

            if (spec_type === 'function') {

                //
                // execute the function
                //
                spec.target.apply(null, spec.args);
            }
            else {
                var $newBlock = spec.new_block;
                var $target = spec.target;

                // execute replacement
                switch (spec_type) {
                    case 'replace':
                        $target[0].innerHTML = $newBlock[0].innerHTML;
                        break;
                    case 'insertAfter':
                        $newBlock.insertAfter($target);
                        break;
                    case 'remove':
                        $newBlock.remove();
                        break;
                    case 'prependTo':
                        $newBlock.prependTo($target);
                        break;
                    default:
                        $j.error('Unknown spec type: ' + spec_type);
                }
            }
        }
    });
</script>
```

## Examples
See Demo page under demo/

You can run the demo by:

- git clone git@github.com:lokku/jquery-ddjax.git
- cd jquery-ddjax
- python -m SimpleHTTPServer
- browse to http://localhost:8000/demo/

## Documentation
See Demo page for documentation as well.

## Release History

version 0.1.0

    * first release
